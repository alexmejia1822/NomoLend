// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/INomoLend.sol";
import "./libraries/InterestCalculator.sol";
import "./OrderBook.sol";
import "./CollateralManager.sol";
import "./RiskEngine.sol";
import "./LiquidationEngine.sol";
import "./ProtocolConfig.sol";
import "./PriceOracle.sol";

/// @title LoanManager - Core loan lifecycle management for NomoLend
/// @notice Handles loan creation from orders, repayment, and liquidation
///         Each loan is independent and isolated (no liquidity pools)
contract LoanManager is INomoLend, ReentrancyGuard, Pausable, AccessControl {
    using SafeERC20 for IERC20;
    using InterestCalculator for uint256;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant LIQUIDATOR_ROLE = keccak256("LIQUIDATOR_ROLE");

    /// @notice Grace period after loan expiry where borrower can still repay (H-01 fix)
    uint256 public constant REPAYMENT_GRACE_PERIOD = 4 hours;

    /// @notice Minimum loan amount in USDC (10 USDC) (H-04 fix)
    uint256 public constant MIN_LOAN_AMOUNT = 10 * 1e6;

    /// @notice Liquidation bonus for public liquidators (1%)
    uint256 public constant LIQUIDATION_BONUS_BPS = 100;

    /// @notice Whether public liquidation is enabled
    bool public publicLiquidationEnabled;

    event LiquidationExecuted(uint256 indexed loanId, address indexed liquidator, uint256 bonus);
    event PublicLiquidationToggled(bool enabled);
    event ReserveFundUpdated(address indexed newFund);
    event ReserveFeeBpsUpdated(uint256 newBps);
    event ReserveDeposited(uint256 amount);

    // ============================================================
    //                     STATE VARIABLES
    // ============================================================

    ProtocolConfig public immutable config;
    OrderBook public immutable orderBook;
    CollateralManager public immutable collateralManager;
    RiskEngine public immutable riskEngine;
    LiquidationEngine public immutable liquidationEngine;
    PriceOracle public immutable priceOracle;
    IERC20 public immutable usdc;

    /// @notice Reserve fund address (receives portion of platform fees)
    address public reserveFund;
    /// @notice Percentage of platform fee allocated to reserve (default 20% = 2% of interest)
    uint256 public reserveFeeBps = 2000;

    /// @notice All loans by ID
    mapping(uint256 => Loan) public loans;
    uint256 public nextLoanId;

    /// @notice User's loan IDs (as borrower)
    mapping(address => uint256[]) public borrowerLoans;

    /// @notice User's loan IDs (as lender)
    mapping(address => uint256[]) public lenderLoans;

    // ============================================================
    //                       CONSTRUCTOR
    // ============================================================

    constructor(
        address _config,
        address _orderBook,
        address _collateralManager,
        address _riskEngine,
        address _liquidationEngine,
        address _priceOracle
    ) {
        config = ProtocolConfig(_config);
        orderBook = OrderBook(_orderBook);
        collateralManager = CollateralManager(_collateralManager);
        riskEngine = RiskEngine(_riskEngine);
        liquidationEngine = LiquidationEngine(_liquidationEngine);
        priceOracle = PriceOracle(_priceOracle);
        usdc = IERC20(config.usdc());

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    // ============================================================
    //              LOAN CREATION FROM LENDING ORDER
    // ============================================================

    /// @notice Borrower takes a loan from a lending order
    /// @param lendingOrderId The lending order to borrow from
    /// @param amount USDC amount to borrow (can be partial)
    /// @param collateralToken Token to use as collateral
    /// @param collateralAmount Amount of collateral to deposit
    /// @return loanId The new loan ID
    function takeLoan(
        uint256 lendingOrderId,
        uint256 amount,
        address collateralToken,
        uint256 collateralAmount
    ) external nonReentrant whenNotPaused returns (uint256 loanId) {
        require(amount >= MIN_LOAN_AMOUNT, "Below minimum loan amount");

        // Get lending order details
        LendingOrder memory order = orderBook.getLendingOrder(lendingOrderId);
        require(order.status == OrderStatus.OPEN, "Order not open");

        // Fill the lending order (transfers USDC to this contract)
        uint256 filledAmount = orderBook.fillLendingOrder(lendingOrderId, amount);

        // H-3-01: validate filledAmount after partial fill
        require(filledAmount >= MIN_LOAN_AMOUNT, "Filled amount below minimum");

        // Circuit breaker: check for extreme price drops before validation
        riskEngine.checkCircuitBreaker(collateralToken);

        // Validate token risk against actual filled amount
        riskEngine.validateNewLoan(collateralToken, filledAmount, msg.sender);

        // H-3-02: calculate required collateral based on actual filledAmount
        uint256 requiredCollateral = riskEngine.calculateRequiredCollateral(collateralToken, filledAmount);
        require(collateralAmount >= requiredCollateral, "Insufficient collateral");

        // Adjust collateral to what's actually needed (avoid over-locking)
        uint256 actualCollateral = collateralAmount > requiredCollateral ? requiredCollateral : collateralAmount;

        // Create the loan
        loanId = nextLoanId++;
        loans[loanId] = Loan({
            loanId: loanId,
            lender: order.lender,
            borrower: msg.sender,
            principal: filledAmount,
            collateralToken: collateralToken,
            collateralAmount: actualCollateral,
            startTimestamp: block.timestamp,
            duration: order.duration,
            status: LoanStatus.ACTIVE,
            interestPaid: 0,
            repaidAt: 0
        });

        borrowerLoans[msg.sender].push(loanId);
        lenderLoans[order.lender].push(loanId);

        // Lock collateral (borrower must have approved CollateralManager)
        collateralManager.depositCollateral(loanId, collateralToken, actualCollateral, msg.sender);

        // Transfer USDC to borrower
        usdc.safeTransfer(msg.sender, filledAmount);

        // Update exposure and loan count tracking
        riskEngine.addExposure(collateralToken, filledAmount);
        riskEngine.incrementUserLoanCount(msg.sender, collateralToken);

        emit LoanCreated(loanId, order.lender, msg.sender, filledAmount, collateralToken);
    }

    // ============================================================
    //          LOAN CREATION FROM BORROW REQUEST (LENDER FILLS)
    // ============================================================

    /// @notice Lender fills a borrow request
    /// @param borrowRequestId The borrow request to fill
    /// @param amount USDC amount to lend (can be partial)
    /// @return loanId The new loan ID
    function fillBorrowRequest(
        uint256 borrowRequestId,
        uint256 amount
    ) external nonReentrant whenNotPaused returns (uint256 loanId) {
        require(amount >= MIN_LOAN_AMOUNT, "Below minimum loan amount");

        BorrowRequest memory request = orderBook.getBorrowRequest(borrowRequestId);
        require(request.status == OrderStatus.OPEN, "Request not open");

        // Fill the borrow request (get collateral portion)
        (uint256 filledAmount, uint256 collateralPortion) = orderBook.fillBorrowRequest(borrowRequestId, amount);

        // H-3-01: validate filledAmount after partial fill
        require(filledAmount >= MIN_LOAN_AMOUNT, "Filled amount below minimum");

        // Circuit breaker: check for extreme price drops before validation
        riskEngine.checkCircuitBreaker(request.collateralToken);

        // Validate token risk against actual filled amount
        riskEngine.validateNewLoan(request.collateralToken, filledAmount, request.borrower);

        // Transfer USDC from lender
        usdc.safeTransferFrom(msg.sender, address(this), filledAmount);

        // Create the loan
        loanId = nextLoanId++;
        loans[loanId] = Loan({
            loanId: loanId,
            lender: msg.sender,
            borrower: request.borrower,
            principal: filledAmount,
            collateralToken: request.collateralToken,
            collateralAmount: collateralPortion,
            startTimestamp: block.timestamp,
            duration: request.duration,
            status: LoanStatus.ACTIVE,
            interestPaid: 0,
            repaidAt: 0
        });

        borrowerLoans[request.borrower].push(loanId);
        lenderLoans[msg.sender].push(loanId);

        // Move collateral from OrderBook to CollateralManager
        // The OrderBook already transferred collateral to this contract via fillBorrowRequest
        IERC20(request.collateralToken).forceApprove(address(collateralManager), collateralPortion);
        collateralManager.depositCollateral(loanId, request.collateralToken, collateralPortion, address(this));

        // Transfer USDC to borrower
        usdc.safeTransfer(request.borrower, filledAmount);

        // Update exposure and loan count tracking
        riskEngine.addExposure(request.collateralToken, filledAmount);
        riskEngine.incrementUserLoanCount(request.borrower, request.collateralToken);

        emit LoanCreated(loanId, msg.sender, request.borrower, filledAmount, request.collateralToken);
    }

    // ============================================================
    //                      REPAYMENT
    // ============================================================

    /// @notice Borrower repays a loan (early or at maturity)
    /// @param loanId The loan to repay
    function repayLoan(uint256 loanId) external nonReentrant {
        Loan storage loan = loans[loanId];
        require(loan.status == LoanStatus.ACTIVE, "Loan not active");
        require(msg.sender == loan.borrower, "Not borrower");

        uint256 elapsed = block.timestamp - loan.startTimestamp;
        uint256 maxDuration = InterestCalculator.getDurationSeconds(loan.duration);

        // Loan must not be expired beyond grace period (H-01 fix)
        require(elapsed <= maxDuration + REPAYMENT_GRACE_PERIOD, "Loan expired beyond grace period");

        // Calculate interest based on bracket reached
        (uint256 interest,) = InterestCalculator.calculateInterest(
            loan.principal,
            loan.duration,
            elapsed
        );

        // Calculate platform fee (10% of interest)
        uint256 platformFee = config.calculatePlatformFee(interest);
        uint256 lenderInterest = interest - platformFee;
        uint256 totalRepayment = loan.principal + interest;

        // Transfer repayment from borrower
        usdc.safeTransferFrom(msg.sender, address(this), totalRepayment);

        // Split platform fee: reserve fund portion + treasury
        uint256 reservePortion = 0;
        if (reserveFund != address(0) && reserveFeeBps > 0) {
            reservePortion = (platformFee * reserveFeeBps) / 10_000;
        }
        uint256 treasuryPortion = platformFee - reservePortion;

        // Distribute payments
        usdc.safeTransfer(loan.lender, loan.principal + lenderInterest);
        usdc.safeTransfer(config.treasury(), treasuryPortion);
        if (reservePortion > 0) {
            usdc.safeTransfer(reserveFund, reservePortion);
            emit ReserveDeposited(reservePortion);
        }

        // Release collateral back to borrower
        collateralManager.releaseCollateral(
            loanId,
            loan.collateralToken,
            loan.collateralAmount,
            loan.borrower
        );

        // Update loan state
        loan.status = LoanStatus.REPAID;
        loan.interestPaid = interest;
        loan.repaidAt = block.timestamp;

        // Remove exposure and decrement loan count
        riskEngine.removeExposure(loan.collateralToken, loan.principal);
        riskEngine.decrementUserLoanCount(loan.borrower, loan.collateralToken);

        emit LoanRepaid(loanId, loan.principal, interest, platformFee);
    }

    // ============================================================
    //                      LIQUIDATION
    // ============================================================

    function setPublicLiquidation(bool enabled) external onlyRole(ADMIN_ROLE) {
        publicLiquidationEnabled = enabled;
        emit PublicLiquidationToggled(enabled);
    }

    /// @notice Liquidate a loan (expired or undercollateralized)
    /// @param loanId The loan to liquidate
    /// @param minAmountOut Minimum USDC from collateral swap (slippage protection)
    function liquidateLoan(
        uint256 loanId,
        uint256 minAmountOut
    ) external nonReentrant {
        require(
            hasRole(LIQUIDATOR_ROLE, msg.sender) || publicLiquidationEnabled,
            "Not authorized to liquidate"
        );
        Loan storage loan = loans[loanId];
        require(loan.status == LoanStatus.ACTIVE, "Loan not active");

        uint256 elapsed = block.timestamp - loan.startTimestamp;
        uint256 maxDuration = InterestCalculator.getDurationSeconds(loan.duration);
        // Expired only after grace period (H-01 fix)
        bool isExpired = elapsed > maxDuration + REPAYMENT_GRACE_PERIOD;

        // Must be either expired (past grace) or undercollateralized
        if (!isExpired) {
            (uint256 checkInterest,) = InterestCalculator.calculateInterest(
                loan.principal,
                loan.duration,
                elapsed
            );
            uint256 checkDebt = loan.principal + checkInterest;
            bool liquidatable = riskEngine.isLiquidatable(
                loan.collateralToken,
                loan.collateralAmount,
                checkDebt
            );
            require(liquidatable, "Loan not liquidatable");
        }

        // Calculate interest and penalty
        (uint256 interest,) = InterestCalculator.calculateInterest(
            loan.principal,
            loan.duration,
            elapsed > maxDuration ? maxDuration : elapsed
        );

        uint256 penalty = 0;
        if (isExpired) {
            // 2% penalty for expired loans
            penalty = (loan.principal * config.EXPIRY_PENALTY_BPS()) / 10_000;
        }

        uint256 totalDebt = loan.principal + interest + penalty;
        uint256 platformFee = config.calculatePlatformFee(interest);

        // Release collateral to liquidation engine
        uint256 collateralAmount = collateralManager.releaseForLiquidation(
            loanId,
            loan.collateralToken,
            address(liquidationEngine)
        );

        // Execute liquidation swap
        uint256 usdcReceived = liquidationEngine.liquidateCollateral(
            loan.collateralToken,
            collateralAmount,
            minAmountOut
        );

        // Calculate liquidation bonus for public liquidators
        uint256 liquidatorBonus = 0;
        bool isPublicLiquidator = !hasRole(LIQUIDATOR_ROLE, msg.sender);
        if (isPublicLiquidator && usdcReceived > totalDebt) {
            liquidatorBonus = (usdcReceived * LIQUIDATION_BONUS_BPS) / 10_000;
            // Cap bonus so lender still gets full debt
            if (usdcReceived - liquidatorBonus < totalDebt) {
                liquidatorBonus = usdcReceived - totalDebt;
            }
        }

        // Distribute proceeds (minus bonus)
        liquidationEngine.distributeProceeds(
            loan.lender,
            loan.borrower,
            config.treasury(),
            totalDebt - platformFee,
            platformFee,
            usdcReceived - liquidatorBonus
        );

        // Pay bonus to liquidator
        if (liquidatorBonus > 0) {
            liquidationEngine.payLiquidatorBonus(msg.sender, liquidatorBonus);
        }

        // Update loan state
        loan.status = LoanStatus.LIQUIDATED;
        loan.interestPaid = interest;
        loan.repaidAt = block.timestamp;

        // Remove exposure and decrement loan count
        riskEngine.removeExposure(loan.collateralToken, loan.principal);
        riskEngine.decrementUserLoanCount(loan.borrower, loan.collateralToken);

        emit LoanLiquidated(loanId, collateralAmount, usdcReceived, liquidatorBonus);
        emit LiquidationExecuted(loanId, msg.sender, liquidatorBonus);
    }

    // ============================================================
    //                      ADMIN FUNCTIONS
    // ============================================================

    function setReserveFund(address _reserveFund) external onlyRole(ADMIN_ROLE) {
        reserveFund = _reserveFund;
        emit ReserveFundUpdated(_reserveFund);
    }

    function setReserveFeeBps(uint256 bps) external onlyRole(ADMIN_ROLE) {
        require(bps <= 5000, "Max 50% of platform fee");
        reserveFeeBps = bps;
        emit ReserveFeeBpsUpdated(bps);
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    // ============================================================
    //                      VIEW FUNCTIONS
    // ============================================================

    function getLoan(uint256 loanId) external view returns (Loan memory) {
        return loans[loanId];
    }

    function getBorrowerLoans(address borrower) external view returns (uint256[] memory) {
        return borrowerLoans[borrower];
    }

    function getLenderLoans(address lender) external view returns (uint256[] memory) {
        return lenderLoans[lender];
    }

    function getBorrowerLoansPaginated(address borrower, uint256 offset, uint256 limit) external view returns (uint256[] memory) {
        return _paginate(borrowerLoans[borrower], offset, limit);
    }

    function getLenderLoansPaginated(address lender, uint256 offset, uint256 limit) external view returns (uint256[] memory) {
        return _paginate(lenderLoans[lender], offset, limit);
    }

    function _paginate(uint256[] storage arr, uint256 offset, uint256 limit) internal view returns (uint256[] memory) {
        if (offset >= arr.length) return new uint256[](0);
        uint256 end = offset + limit;
        if (end > arr.length) end = arr.length;
        uint256[] memory result = new uint256[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = arr[i];
        }
        return result;
    }

    /// @notice Get total protocol loans created
    function getTotalProtocolLoans() external view returns (uint256) {
        return nextLoanId;
    }

    /// @notice Calculate current debt for a loan (principal + interest)
    function getCurrentDebt(uint256 loanId) external view returns (uint256 totalDebt, uint256 interest) {
        Loan storage loan = loans[loanId];
        // M-5-01: prevent ghost reads on non-existent loans (default struct has status=0=ACTIVE)
        require(loan.principal > 0, "Loan does not exist");
        require(loan.status == LoanStatus.ACTIVE, "Loan not active");

        uint256 elapsed = block.timestamp - loan.startTimestamp;
        (interest,) = InterestCalculator.calculateInterest(loan.principal, loan.duration, elapsed);
        totalDebt = loan.principal + interest;
    }

    /// @notice Get health factor for a loan
    function getLoanHealthFactor(uint256 loanId) external view returns (uint256) {
        Loan storage loan = loans[loanId];
        // M-5-01: prevent ghost reads on non-existent loans
        require(loan.principal > 0, "Loan does not exist");
        require(loan.status == LoanStatus.ACTIVE, "Loan not active");

        uint256 elapsed = block.timestamp - loan.startTimestamp;
        (uint256 interest,) = InterestCalculator.calculateInterest(loan.principal, loan.duration, elapsed);
        uint256 totalDebt = loan.principal + interest;

        return riskEngine.calculateHealthFactor(loan.collateralToken, loan.collateralAmount, totalDebt);
    }

    /// @notice Check if a loan is liquidatable
    function isLoanLiquidatable(uint256 loanId) external view returns (bool expired, bool undercollateralized) {
        Loan storage loan = loans[loanId];
        // M-3-04: filter out non-existent loans (default struct has status=0=ACTIVE)
        if (loan.status != LoanStatus.ACTIVE || loan.principal == 0) return (false, false);

        uint256 elapsed = block.timestamp - loan.startTimestamp;
        uint256 maxDuration = InterestCalculator.getDurationSeconds(loan.duration);
        expired = elapsed > maxDuration + REPAYMENT_GRACE_PERIOD;

        (uint256 interest,) = InterestCalculator.calculateInterest(loan.principal, loan.duration, elapsed);
        uint256 totalDebt = loan.principal + interest;
        undercollateralized = riskEngine.isLiquidatable(loan.collateralToken, loan.collateralAmount, totalDebt);
    }
}
