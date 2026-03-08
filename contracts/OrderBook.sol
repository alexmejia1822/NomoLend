// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/INomoLend.sol";

/// @title OrderBook - Manages lending offers and borrow requests
/// @notice Two-sided orderbook: lenders offer USDC, borrowers request USDC with collateral
///         Orders can be partially filled and cancelled while open
contract OrderBook is INomoLend, ReentrancyGuard, Pausable, AccessControl {
    using SafeERC20 for IERC20;

    bytes32 public constant LOAN_MANAGER_ROLE = keccak256("LOAN_MANAGER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    // ============================================================
    //                     STATE VARIABLES
    // ============================================================

    IERC20 public immutable usdc;

    /// @notice Lending orders by ID
    mapping(uint256 => LendingOrder) public lendingOrders;
    uint256 public nextLendingOrderId;

    /// @notice Borrow requests by ID
    mapping(uint256 => BorrowRequest) public borrowRequests;
    uint256 public nextBorrowRequestId;

    /// @notice User's lending order IDs
    mapping(address => uint256[]) public userLendingOrders;

    /// @notice User's borrow request IDs
    mapping(address => uint256[]) public userBorrowRequests;

    /// @notice Max active orders per user (DOS protection)
    uint256 public maxActiveOrdersPerUser = 20;

    /// @notice Active order count per user
    mapping(address => uint256) public activeOrderCount;

    // ============================================================
    //                       CONSTRUCTOR
    // ============================================================

    constructor(address _usdc) {
        require(_usdc != address(0), "Invalid USDC");
        usdc = IERC20(_usdc);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    // ============================================================
    //                    LENDING ORDERS
    // ============================================================

    /// @notice Create a lending offer
    /// @param amount USDC amount to lend
    /// @param duration Loan duration bracket
    /// @return orderId The new order ID
    function createLendingOrder(
        uint256 amount,
        Duration duration
    ) external nonReentrant whenNotPaused returns (uint256 orderId) {
        require(amount > 0, "Amount must be > 0");
        require(activeOrderCount[msg.sender] < maxActiveOrdersPerUser, "Too many active orders");

        orderId = nextLendingOrderId++;
        activeOrderCount[msg.sender]++;

        // Transfer USDC from lender to this contract
        usdc.safeTransferFrom(msg.sender, address(this), amount);

        lendingOrders[orderId] = LendingOrder({
            lender: msg.sender,
            totalAmount: amount,
            availableAmount: amount,
            duration: duration,
            status: OrderStatus.OPEN,
            createdAt: block.timestamp
        });

        userLendingOrders[msg.sender].push(orderId);

        emit LendingOrderCreated(orderId, msg.sender, amount, duration);
    }

    /// @notice Cancel an open lending order (returns USDC to lender)
    function cancelLendingOrder(uint256 orderId) external nonReentrant {
        LendingOrder storage order = lendingOrders[orderId];
        require(order.lender == msg.sender, "Not order owner");
        require(order.status == OrderStatus.OPEN, "Order not open");
        require(order.availableAmount > 0, "No funds to return");

        uint256 returnAmount = order.availableAmount;
        order.availableAmount = 0;
        order.status = OrderStatus.CANCELLED;

        if (activeOrderCount[msg.sender] > 0) activeOrderCount[msg.sender]--;

        usdc.safeTransfer(msg.sender, returnAmount);

        emit LendingOrderCancelled(orderId);
    }

    /// @notice Fill a lending order (partially or fully) — called by LoanManager
    /// @return filledAmount The actual amount filled
    function fillLendingOrder(
        uint256 orderId,
        uint256 amount
    ) external onlyRole(LOAN_MANAGER_ROLE) returns (uint256 filledAmount) {
        LendingOrder storage order = lendingOrders[orderId];
        require(order.status == OrderStatus.OPEN, "Order not open");
        require(order.availableAmount > 0, "No available funds");

        filledAmount = amount > order.availableAmount ? order.availableAmount : amount;
        order.availableAmount -= filledAmount;

        if (order.availableAmount == 0) {
            order.status = OrderStatus.FILLED;
            if (activeOrderCount[order.lender] > 0) activeOrderCount[order.lender]--;
            // L-5-03: emit event when lending order is fully filled
            emit LendingOrderFilled(orderId, order.lender);
        }

        // Transfer USDC to LoanManager for disbursement
        usdc.safeTransfer(msg.sender, filledAmount);
    }

    // ============================================================
    //                    BORROW REQUESTS
    // ============================================================

    /// @notice Create a borrow request with collateral
    /// @param requestedAmount USDC amount to borrow
    /// @param collateralToken ERC20 collateral token address
    /// @param collateralAmount Amount of collateral to deposit
    /// @param duration Loan duration bracket
    /// @return requestId The new request ID
    function createBorrowRequest(
        uint256 requestedAmount,
        address collateralToken,
        uint256 collateralAmount,
        Duration duration
    ) external nonReentrant whenNotPaused returns (uint256 requestId) {
        require(requestedAmount > 0, "Amount must be > 0");
        require(collateralToken != address(0), "Invalid collateral token");
        require(collateralAmount > 0, "Collateral must be > 0");
        require(activeOrderCount[msg.sender] < maxActiveOrdersPerUser, "Too many active orders");

        requestId = nextBorrowRequestId++;
        activeOrderCount[msg.sender]++;

        // Lock collateral immediately
        IERC20(collateralToken).safeTransferFrom(msg.sender, address(this), collateralAmount);

        borrowRequests[requestId] = BorrowRequest({
            borrower: msg.sender,
            requestedAmount: requestedAmount,
            filledAmount: 0,
            collateralToken: collateralToken,
            collateralAmount: collateralAmount,
            collateralAllocated: 0,
            duration: duration,
            status: OrderStatus.OPEN,
            createdAt: block.timestamp
        });

        userBorrowRequests[msg.sender].push(requestId);

        emit BorrowRequestCreated(requestId, msg.sender, requestedAmount, collateralToken);
    }

    /// @notice Cancel an open borrow request (returns remaining collateral)
    /// @dev Now supports partially filled requests — returns unallocated collateral (H-02 fix)
    function cancelBorrowRequest(uint256 requestId) external nonReentrant {
        BorrowRequest storage request = borrowRequests[requestId];
        require(request.borrower == msg.sender, "Not request owner");
        require(request.status == OrderStatus.OPEN, "Request not open");

        request.status = OrderStatus.CANCELLED;

        if (activeOrderCount[msg.sender] > 0) activeOrderCount[msg.sender]--;

        // M-3-01: use actual tracked allocation instead of recalculating (avoids rounding mismatch)
        uint256 remainingCollateral = request.collateralAmount - request.collateralAllocated;

        // Return remaining collateral to borrower
        if (remainingCollateral > 0) {
            IERC20(request.collateralToken).safeTransfer(msg.sender, remainingCollateral);
        }

        emit BorrowRequestCancelled(requestId);
    }

    /// @notice Fill a borrow request — called by LoanManager
    /// @return filledAmount Actual USDC amount matched
    /// @return collateralPortion Proportional collateral for this fill
    function fillBorrowRequest(
        uint256 requestId,
        uint256 amount
    ) external onlyRole(LOAN_MANAGER_ROLE) returns (uint256 filledAmount, uint256 collateralPortion) {
        BorrowRequest storage request = borrowRequests[requestId];
        require(request.status == OrderStatus.OPEN, "Request not open");

        uint256 remaining = request.requestedAmount - request.filledAmount;
        require(remaining > 0, "Fully filled");

        filledAmount = amount > remaining ? remaining : amount;

        // Calculate proportional collateral
        collateralPortion = (request.collateralAmount * filledAmount) / request.requestedAmount;

        request.filledAmount += filledAmount;
        request.collateralAllocated += collateralPortion;

        if (request.filledAmount >= request.requestedAmount) {
            request.status = OrderStatus.FILLED;
            if (activeOrderCount[request.borrower] > 0) activeOrderCount[request.borrower]--;
        }

        // Transfer collateral portion to LoanManager (which will send to CollateralManager)
        IERC20(request.collateralToken).safeTransfer(msg.sender, collateralPortion);
    }

    // ============================================================
    //                      ADMIN FUNCTIONS
    // ============================================================

    function setMaxActiveOrdersPerUser(uint256 max) external onlyRole(ADMIN_ROLE) {
        require(max > 0 && max <= 100, "Range 1-100");
        maxActiveOrdersPerUser = max;
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

    function getLendingOrder(uint256 orderId) external view returns (LendingOrder memory) {
        return lendingOrders[orderId];
    }

    function getBorrowRequest(uint256 requestId) external view returns (BorrowRequest memory) {
        return borrowRequests[requestId];
    }

    function getUserLendingOrders(address user) external view returns (uint256[] memory) {
        return userLendingOrders[user];
    }

    function getUserBorrowRequests(address user) external view returns (uint256[] memory) {
        return userBorrowRequests[user];
    }

    function getUserLendingOrdersPaginated(address user, uint256 offset, uint256 limit) external view returns (uint256[] memory) {
        return _paginate(userLendingOrders[user], offset, limit);
    }

    function getUserBorrowRequestsPaginated(address user, uint256 offset, uint256 limit) external view returns (uint256[] memory) {
        return _paginate(userBorrowRequests[user], offset, limit);
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
}
