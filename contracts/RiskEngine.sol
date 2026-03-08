// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/INomoLend.sol";
import "./interfaces/IPriceOracle.sol";
import "./interfaces/ITokenValidator.sol";

/// @title RiskEngine - Dynamic risk assessment for collateral tokens
/// @notice Manages LTV ratios, liquidation thresholds, exposure limits, and anomaly detection
///
/// Risk Table:
///   Market Cap > $150M -> LTV 40%, Liq Threshold 60%
///   Market Cap > $100M -> LTV 35%, Liq Threshold 55%
///   Market Cap > $50M  -> LTV 30%, Liq Threshold 50%
///   Market Cap > $20M  -> LTV 25%, Liq Threshold 50%
contract RiskEngine is AccessControl {
    bytes32 public constant RISK_MANAGER_ROLE = keccak256("RISK_MANAGER_ROLE");

    uint256 public constant BPS_DENOMINATOR = 10_000;

    // ============================================================
    //                     STATE VARIABLES
    // ============================================================

    IPriceOracle public priceOracle;
    ITokenValidator public tokenValidator;

    /// @notice Risk parameters per token (set by risk manager based on off-chain metrics)
    mapping(address => INomoLend.TokenRiskParams) public tokenRiskParams;

    /// @notice Current total exposure per token (in USDC)
    mapping(address => uint256) public currentExposure;

    /// @notice Tokens paused due to anomaly detection
    mapping(address => bool) public pausedTokens;

    /// @notice Track borrowing surge: token => window start => amount
    mapping(address => uint256) public borrowWindowStart;
    mapping(address => uint256) public borrowWindowAmount;

    /// @notice Anomaly detection: max borrowing in a 1-hour window
    uint256 public surgeThresholdUsdc = 50_000 * 1e6; // 50k USDC
    uint256 public surgeWindowSeconds = 1 hours;

    /// @notice Max active loans per user per token (DOS protection)
    uint256 public maxLoansPerUserPerToken = 5;
    mapping(address => mapping(address => uint256)) public userTokenLoanCount;

    // ---- Circuit Breaker (Task 2) ----
    /// @notice Price snapshot for circuit breaker detection
    mapping(address => uint256) public priceSnapshot;
    mapping(address => uint256) public snapshotTimestamp;
    /// @notice Price drop threshold to trigger circuit breaker (default 30%)
    uint256 public priceDropThresholdBps = 3000;

    // ---- Liquidity Requirements (Tasks 3 & 4) ----
    /// @notice DEX liquidity per token (set by keeper, in USDC 6 decimals)
    mapping(address => uint256) public tokenDexLiquidity;
    /// @notice M-5-04: timestamp of last liquidity update per token
    mapping(address => uint256) public tokenDexLiquidityUpdatedAt;
    /// @notice M-5-04: max staleness for DEX liquidity data (default 6 hours)
    uint256 public maxLiquidityStaleness = 6 hours;
    /// @notice Minimum DEX liquidity required per token
    mapping(address => uint256) public minDexLiquidity;
    /// @notice Max loan as percentage of token DEX liquidity (default 15%)
    uint256 public maxLoanToLiquidityBps = 1500;

    // ---- Token Registry (Task 6) ----
    address[] public registeredTokens;
    mapping(address => bool) public isRegisteredToken;

    // ============================================================
    //                         EVENTS
    // ============================================================

    event TokenRiskParamsUpdated(address indexed token, uint256 ltvBps, uint256 liquidationBps, uint256 maxExposure);
    event ExposureUpdated(address indexed token, uint256 newExposure);
    event SurgeDetected(address indexed token, uint256 amountInWindow);
    event SurgeThresholdUpdated(uint256 newThreshold);
    event TokenDeactivated(address indexed token);
    event MaxLoansPerUserPerTokenUpdated(uint256 newMax);
    event CircuitBreakerTriggered(address indexed token, uint256 oldPrice, uint256 newPrice, uint256 dropBps);
    event PriceSnapshotUpdated(address indexed token, uint256 price);
    event LiquidityRequirementUpdated(address indexed token, uint256 minLiquidity);
    event TokenDexLiquidityUpdated(address indexed token, uint256 liquidity);
    event PriceDropThresholdUpdated(uint256 newThresholdBps);
    event MaxLoanToLiquidityUpdated(uint256 newBps);
    event MaxLiquidityStalenessUpdated(uint256 newStaleness);

    // ============================================================
    //                       CONSTRUCTOR
    // ============================================================

    constructor(address _priceOracle, address _tokenValidator) {
        require(_priceOracle != address(0) && _tokenValidator != address(0), "Invalid addresses");
        priceOracle = IPriceOracle(_priceOracle);
        tokenValidator = ITokenValidator(_tokenValidator);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(RISK_MANAGER_ROLE, msg.sender);
    }

    // ============================================================
    //                   RISK MANAGER FUNCTIONS
    // ============================================================

    /// @notice Set risk parameters for a collateral token
    function setTokenRiskParams(
        address token,
        uint256 ltvBps,
        uint256 liquidationThresholdBps,
        uint256 maxExposure
    ) external onlyRole(RISK_MANAGER_ROLE) {
        require(ltvBps > 0 && ltvBps < liquidationThresholdBps, "Invalid LTV");
        require(liquidationThresholdBps <= 9000, "Threshold too high"); // Max 90%
        require(maxExposure > 0, "Invalid max exposure");

        tokenRiskParams[token] = INomoLend.TokenRiskParams({
            ltvBps: ltvBps,
            liquidationThresholdBps: liquidationThresholdBps,
            maxExposure: maxExposure,
            isActive: true
        });

        // Register token for dashboard enumeration
        if (!isRegisteredToken[token]) {
            registeredTokens.push(token);
            isRegisteredToken[token] = true;
        }

        emit TokenRiskParamsUpdated(token, ltvBps, liquidationThresholdBps, maxExposure);
    }

    /// @notice Deactivate a token (no new loans) (L-03 fix: emit event)
    function deactivateToken(address token) external onlyRole(RISK_MANAGER_ROLE) {
        tokenRiskParams[token].isActive = false;
        emit TokenDeactivated(token);
    }

    /// @notice Pause/unpause a token due to anomaly
    function setTokenPaused(address token, bool paused, string calldata reason) external onlyRole(RISK_MANAGER_ROLE) {
        pausedTokens[token] = paused;
        if (paused) {
            emit INomoLend.TokenPaused(token, reason);
        } else {
            emit INomoLend.TokenUnpaused(token);
        }
    }

    function setSurgeThreshold(uint256 threshold) external onlyRole(RISK_MANAGER_ROLE) {
        surgeThresholdUsdc = threshold;
        emit SurgeThresholdUpdated(threshold);
    }

    function setMaxLoansPerUserPerToken(uint256 max) external onlyRole(RISK_MANAGER_ROLE) {
        require(max > 0 && max <= 50, "Range 1-50");
        maxLoansPerUserPerToken = max;
        emit MaxLoansPerUserPerTokenUpdated(max);
    }

    // ============================================================
    //                    RISK ASSESSMENT
    // ============================================================

    /// @notice Validate that a token can be used for a new loan
    /// @param token Collateral token address
    /// @param loanAmountUsdc USDC amount of the loan
    function validateNewLoan(address token, uint256 loanAmountUsdc, address borrower) external view {
        // Token must be active
        INomoLend.TokenRiskParams storage params = tokenRiskParams[token];
        require(params.isActive, "Token not active for lending");

        // Token must not be paused
        require(!pausedTokens[token], "Token paused due to anomaly");

        // Token must pass security validation
        (bool valid, string memory reason) = tokenValidator.validateToken(token);
        require(valid, string.concat("Token validation failed: ", reason));

        // Check exposure limit
        require(
            currentExposure[token] + loanAmountUsdc <= params.maxExposure,
            "Token exposure limit reached"
        );

        // DOS protection: limit loans per user per token
        require(
            userTokenLoanCount[borrower][token] < maxLoansPerUserPerToken,
            "Max loans per token reached"
        );

        // Liquidity requirement: token must have minimum DEX liquidity
        if (minDexLiquidity[token] > 0) {
            // M-5-04: check liquidity data freshness
            require(
                tokenDexLiquidityUpdatedAt[token] > 0 &&
                block.timestamp - tokenDexLiquidityUpdatedAt[token] <= maxLiquidityStaleness,
                "DEX liquidity data stale"
            );
            require(tokenDexLiquidity[token] >= minDexLiquidity[token], "Insufficient DEX liquidity");
        }

        // Loan size vs liquidity: loan must not exceed % of available liquidity
        if (tokenDexLiquidity[token] > 0 && maxLoanToLiquidityBps > 0) {
            uint256 maxLoan = (tokenDexLiquidity[token] * maxLoanToLiquidityBps) / BPS_DENOMINATOR;
            require(loanAmountUsdc <= maxLoan, "Loan exceeds liquidity limit");
        }
    }

    /// @notice Calculate required collateral for a loan
    /// @param token Collateral token
    /// @param loanAmountUsdc USDC loan amount
    /// @return requiredCollateral Amount of collateral tokens needed
    function calculateRequiredCollateral(
        address token,
        uint256 loanAmountUsdc
    ) external view returns (uint256 requiredCollateral) {
        INomoLend.TokenRiskParams storage params = tokenRiskParams[token];
        require(params.isActive, "Token not active");

        // collateral_value = loan_amount / LTV
        // collateral_amount = collateral_value / price_per_token
        (uint256 pricePerToken, bool confidence) = priceOracle.getPrice(token);
        require(confidence, "Price not reliable");
        require(pricePerToken > 0, "Price is zero");

        // Get token decimals from price feed
        // collateralValue = loanAmountUsdc * BPS_DENOMINATOR / ltvBps
        uint256 requiredValueUsdc = (loanAmountUsdc * BPS_DENOMINATOR) / params.ltvBps;

        // Convert USDC value to token amount
        // requiredCollateral = requiredValueUsdc * 10^tokenDecimals / pricePerToken
        // We get tokenDecimals from the oracle
        (, , , , uint8 tokenDecimals, ) = _getPriceFeedData(token);

        requiredCollateral = (requiredValueUsdc * (10 ** tokenDecimals)) / pricePerToken;
    }

    /// @notice Calculate health factor of a loan
    /// @return healthFactor in basis points (10000 = 1.0, healthy)
    function calculateHealthFactor(
        address token,
        uint256 collateralAmount,
        uint256 debtUsdc
    ) external view returns (uint256 healthFactor) {
        if (debtUsdc == 0) return type(uint256).max;

        uint256 collateralValueUsdc = priceOracle.getValueInUsdc(token, collateralAmount);

        INomoLend.TokenRiskParams storage params = tokenRiskParams[token];

        // healthFactor = (collateralValue * liquidationThreshold) / debt
        // Returned in BPS: 10000 = healthy boundary
        healthFactor = (collateralValueUsdc * params.liquidationThresholdBps) / debtUsdc;
    }

    /// @notice Check if a loan is liquidatable based on health factor
    function isLiquidatable(
        address token,
        uint256 collateralAmount,
        uint256 debtUsdc
    ) external view returns (bool) {
        if (debtUsdc == 0) return false;

        uint256 collateralValueUsdc = priceOracle.getValueInUsdc(token, collateralAmount);

        INomoLend.TokenRiskParams storage params = tokenRiskParams[token];

        // Liquidatable when: collateralValue * liquidationThreshold <= debt * BPS
        return (collateralValueUsdc * params.liquidationThresholdBps) <= (debtUsdc * BPS_DENOMINATOR);
    }

    // ============================================================
    //                  EXPOSURE TRACKING
    // ============================================================

    /// @notice Increment user loan count for a token
    function incrementUserLoanCount(address user, address token) external onlyRole(RISK_MANAGER_ROLE) {
        userTokenLoanCount[user][token]++;
    }

    /// @notice Decrement user loan count for a token
    function decrementUserLoanCount(address user, address token) external onlyRole(RISK_MANAGER_ROLE) {
        if (userTokenLoanCount[user][token] > 0) {
            userTokenLoanCount[user][token]--;
        }
    }

    /// @notice Record new exposure when a loan is created
    function addExposure(address token, uint256 amountUsdc) external onlyRole(RISK_MANAGER_ROLE) {
        currentExposure[token] += amountUsdc;
        _checkSurge(token, amountUsdc);
        _updatePriceSnapshot(token);
        emit ExposureUpdated(token, currentExposure[token]);
    }

    /// @notice Remove exposure when a loan is repaid/liquidated
    function removeExposure(address token, uint256 amountUsdc) external onlyRole(RISK_MANAGER_ROLE) {
        if (amountUsdc > currentExposure[token]) {
            currentExposure[token] = 0;
        } else {
            currentExposure[token] -= amountUsdc;
        }
        emit ExposureUpdated(token, currentExposure[token]);
    }

    // ============================================================
    //                    CIRCUIT BREAKER
    // ============================================================

    /// @notice Check circuit breaker for a token — callable by anyone
    /// @dev Compares current oracle price to stored snapshot. If drop > threshold, pauses token.
    function checkCircuitBreaker(address token) external returns (bool triggered) {
        uint256 snapshot = priceSnapshot[token];
        if (snapshot == 0) return false;

        (uint256 currentPrice, ) = priceOracle.getPrice(token);
        if (currentPrice == 0) return false;

        if (currentPrice < snapshot) {
            uint256 dropBps = ((snapshot - currentPrice) * BPS_DENOMINATOR) / snapshot;
            if (dropBps >= priceDropThresholdBps) {
                pausedTokens[token] = true;
                emit CircuitBreakerTriggered(token, snapshot, currentPrice, dropBps);
                emit INomoLend.TokenPaused(token, "Circuit breaker: price drop");
                return true;
            }
        }
        return false;
    }

    function setPriceDropThreshold(uint256 bps) external onlyRole(RISK_MANAGER_ROLE) {
        require(bps >= 500 && bps <= 5000, "Range 5%-50%");
        priceDropThresholdBps = bps;
        emit PriceDropThresholdUpdated(bps);
    }

    // ============================================================
    //                  LIQUIDITY MANAGEMENT
    // ============================================================

    /// @notice Update DEX liquidity for a token (called by keeper)
    function setTokenDexLiquidity(address token, uint256 liquidityUsdc) external onlyRole(RISK_MANAGER_ROLE) {
        tokenDexLiquidity[token] = liquidityUsdc;
        tokenDexLiquidityUpdatedAt[token] = block.timestamp;
        emit TokenDexLiquidityUpdated(token, liquidityUsdc);
    }

    /// @notice Batch update DEX liquidity for multiple tokens
    function batchSetTokenDexLiquidity(
        address[] calldata tokens,
        uint256[] calldata liquidities
    ) external onlyRole(RISK_MANAGER_ROLE) {
        require(tokens.length == liquidities.length, "Length mismatch");
        for (uint256 i = 0; i < tokens.length; i++) {
            tokenDexLiquidity[tokens[i]] = liquidities[i];
            tokenDexLiquidityUpdatedAt[tokens[i]] = block.timestamp;
            emit TokenDexLiquidityUpdated(tokens[i], liquidities[i]);
        }
    }

    /// @notice Set minimum DEX liquidity requirement for a token
    function setMinDexLiquidity(address token, uint256 minLiquidity) external onlyRole(RISK_MANAGER_ROLE) {
        minDexLiquidity[token] = minLiquidity;
        emit LiquidityRequirementUpdated(token, minLiquidity);
    }

    /// @notice Set max loan as % of token liquidity
    function setMaxLoanToLiquidityBps(uint256 bps) external onlyRole(RISK_MANAGER_ROLE) {
        require(bps > 0 && bps <= 5000, "Range 0.01%-50%");
        maxLoanToLiquidityBps = bps;
        emit MaxLoanToLiquidityUpdated(bps);
    }

    /// @notice Set max staleness for liquidity data (M-5-04)
    function setMaxLiquidityStaleness(uint256 seconds_) external onlyRole(RISK_MANAGER_ROLE) {
        require(seconds_ >= 1 hours && seconds_ <= 24 hours, "Range 1h-24h");
        maxLiquidityStaleness = seconds_;
        emit MaxLiquidityStalenessUpdated(seconds_);
    }

    // ============================================================
    //                  DASHBOARD / VIEW FUNCTIONS
    // ============================================================

    /// @notice Get all registered tokens
    function getRegisteredTokens() external view returns (address[] memory) {
        return registeredTokens;
    }

    /// @notice Get total exposure across all tokens
    function getTotalExposure() external view returns (uint256 total) {
        for (uint256 i = 0; i < registeredTokens.length; i++) {
            total += currentExposure[registeredTokens[i]];
        }
    }

    /// @notice Get full risk summary for a token
    function getTokenRiskSummary(address token) external view returns (
        uint256 ltvBps,
        uint256 liquidationThresholdBps,
        uint256 maxExposure,
        bool isActive,
        uint256 exposure,
        bool isPaused,
        uint256 dexLiquidity,
        uint256 minLiquidity,
        uint256 lastPrice,
        uint256 lastSnapshotTime
    ) {
        INomoLend.TokenRiskParams storage params = tokenRiskParams[token];
        ltvBps = params.ltvBps;
        liquidationThresholdBps = params.liquidationThresholdBps;
        maxExposure = params.maxExposure;
        isActive = params.isActive;
        exposure = currentExposure[token];
        isPaused = pausedTokens[token];
        dexLiquidity = tokenDexLiquidity[token];
        minLiquidity = minDexLiquidity[token];
        lastPrice = priceSnapshot[token];
        lastSnapshotTime = snapshotTimestamp[token];
    }

    // ============================================================
    //                   ANOMALY DETECTION
    // ============================================================

    /// @notice Check for borrowing surge and auto-pause if detected
    /// @dev M-01 fix: halve the accumulated amount on window reset instead of zeroing,
    ///      so bursts that straddle window boundaries are still caught
    function _checkSurge(address token, uint256 amountUsdc) internal {
        if (block.timestamp - borrowWindowStart[token] > surgeWindowSeconds) {
            borrowWindowStart[token] = block.timestamp;
            // Carry over half of previous window to catch cross-boundary bursts
            borrowWindowAmount[token] = borrowWindowAmount[token] / 2;
        }

        borrowWindowAmount[token] += amountUsdc;

        if (borrowWindowAmount[token] > surgeThresholdUsdc) {
            pausedTokens[token] = true;
            emit SurgeDetected(token, borrowWindowAmount[token]);
            emit INomoLend.TokenPaused(token, "Borrowing surge detected");
        }
    }

    // ============================================================
    //                    INTERNAL HELPERS
    // ============================================================

    /// @notice Update price snapshot for circuit breaker
    function _updatePriceSnapshot(address token) internal {
        try priceOracle.getPrice(token) returns (uint256 price, bool) {
            if (price > 0 && !pausedTokens[token]) {
                priceSnapshot[token] = price;
                snapshotTimestamp[token] = block.timestamp;
                emit PriceSnapshotUpdated(token, price);
            }
        } catch {}
    }

    function _getPriceFeedData(address token) internal view returns (
        address chainlinkFeed,
        uint8 chainlinkDecimals,
        uint256 twapPrice,
        uint256 lastTwapUpdate,
        uint8 tokenDecimals,
        bool isActive
    ) {
        // Read from PriceOracle storage via public getter
        (bool success, bytes memory data) = address(priceOracle).staticcall(
            abi.encodeWithSignature("priceFeeds(address)", token)
        );
        require(success, "Cannot read price feed");
        (chainlinkFeed, chainlinkDecimals, twapPrice, lastTwapUpdate, tokenDecimals, isActive) =
            abi.decode(data, (address, uint8, uint256, uint256, uint8, bool));
    }
}
