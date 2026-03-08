// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/ISwapRouter.sol";

/// @title LiquidationEngine - Handles collateral liquidation via DEX swaps
/// @notice Sells collateral on DEX routers with slippage protection
///         Supports primary + fallback router pattern
contract LiquidationEngine is ReentrancyGuard, AccessControl {
    using SafeERC20 for IERC20;

    bytes32 public constant LIQUIDATOR_ROLE = keccak256("LIQUIDATOR_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    /// @notice USDC token address
    address public immutable usdc;

    /// @notice Primary DEX router
    address public primaryRouter;

    /// @notice Fallback DEX router
    address public fallbackRouter;

    /// @notice Max slippage in basis points (default 5%)
    uint256 public maxSlippageBps = 500;

    // ============================================================
    //                         EVENTS
    // ============================================================

    event CollateralLiquidated(
        address indexed token,
        uint256 amountIn,
        uint256 amountOut,
        address router
    );
    event RouterUpdated(string routerType, address router);
    event SlippageUpdated(uint256 newSlippageBps);
    event InsufficientFeeProceeds(uint256 platformFee, uint256 available);
    event TokensRescued(address indexed token, uint256 amount, address indexed to);

    // ============================================================
    //                       CONSTRUCTOR
    // ============================================================

    constructor(address _usdc) {
        require(_usdc != address(0), "Invalid USDC");
        usdc = _usdc;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    // ============================================================
    //                     ADMIN FUNCTIONS
    // ============================================================

    function setPrimaryRouter(address _router) external onlyRole(ADMIN_ROLE) {
        require(_router != address(0), "Invalid router");
        primaryRouter = _router;
        emit RouterUpdated("primary", _router);
    }

    function setFallbackRouter(address _router) external onlyRole(ADMIN_ROLE) {
        require(_router != address(0), "Invalid router");
        fallbackRouter = _router;
        emit RouterUpdated("fallback", _router);
    }

    function setMaxSlippage(uint256 bps) external onlyRole(ADMIN_ROLE) {
        require(bps > 0 && bps <= 1000, "Slippage 0.01%-10%");
        maxSlippageBps = bps;
        emit SlippageUpdated(bps);
    }

    // ============================================================
    //                   LIQUIDATION LOGIC
    // ============================================================

    /// @notice Liquidate collateral by swapping to USDC
    /// @param token The collateral token to sell
    /// @param amount The amount of collateral to sell
    /// @param minAmountOut Minimum USDC to receive (slippage protection)
    /// @return usdcReceived Amount of USDC received from the swap
    function liquidateCollateral(
        address token,
        uint256 amount,
        uint256 minAmountOut
    ) external onlyRole(LIQUIDATOR_ROLE) nonReentrant returns (uint256 usdcReceived) {
        require(amount > 0, "Amount must be > 0");
        require(minAmountOut > 0, "minAmountOut must be > 0");
        require(primaryRouter != address(0), "No router configured");

        // Approve primary router
        IERC20(token).forceApprove(primaryRouter, amount);

        // Try primary router first
        try ISwapRouter(primaryRouter).swap(token, usdc, amount, minAmountOut, address(this)) returns (uint256 amountOut) {
            usdcReceived = amountOut;
            // L-3-01: reset approval after successful swap
            IERC20(token).forceApprove(primaryRouter, 0);
            emit CollateralLiquidated(token, amount, amountOut, primaryRouter);
        } catch {
            // Reset approval on primary
            IERC20(token).forceApprove(primaryRouter, 0);

            // Try fallback router
            require(fallbackRouter != address(0), "Fallback router not configured");
            IERC20(token).forceApprove(fallbackRouter, amount);

            usdcReceived = ISwapRouter(fallbackRouter).swap(
                token, usdc, amount, minAmountOut, address(this)
            );
            // L-3-01: reset approval after fallback swap
            IERC20(token).forceApprove(fallbackRouter, 0);
            emit CollateralLiquidated(token, amount, usdcReceived, fallbackRouter);
        }

        require(usdcReceived >= minAmountOut, "Slippage exceeded");
    }

    /// @notice Distribute liquidation proceeds
    /// @param lender Address to receive debt repayment
    /// @param borrower Address to receive surplus
    /// @param treasury Address to receive platform fee
    /// @param debtAmount Total debt (principal + interest)
    /// @param platformFee Platform fee amount
    /// @param totalProceeds Total USDC from liquidation
    function distributeProceeds(
        address lender,
        address borrower,
        address treasury,
        uint256 debtAmount,
        uint256 platformFee,
        uint256 totalProceeds
    ) external onlyRole(LIQUIDATOR_ROLE) nonReentrant {
        require(totalProceeds > 0, "No proceeds");

        uint256 remaining = totalProceeds;

        // 1. Pay platform fee
        if (platformFee > 0 && remaining >= platformFee) {
            IERC20(usdc).safeTransfer(treasury, platformFee);
            remaining -= platformFee;
        } else if (platformFee > 0) {
            // M-5-05: emit event when proceeds insufficient for full fee
            emit InsufficientFeeProceeds(platformFee, remaining);
            // Pay whatever is available
            if (remaining > 0) {
                IERC20(usdc).safeTransfer(treasury, remaining);
                remaining = 0;
            }
        }

        // 2. Pay lender (principal + interest - platform fee)
        uint256 lenderPayment = debtAmount > remaining ? remaining : debtAmount;
        if (lenderPayment > 0) {
            IERC20(usdc).safeTransfer(lender, lenderPayment);
            remaining -= lenderPayment;
        }

        // 3. Return surplus to borrower
        if (remaining > 0) {
            IERC20(usdc).safeTransfer(borrower, remaining);
        }
    }

    /// @notice Pay liquidation bonus to a public liquidator
    function payLiquidatorBonus(address liquidator, uint256 amount) external onlyRole(LIQUIDATOR_ROLE) {
        require(amount > 0, "No bonus");
        IERC20(usdc).safeTransfer(liquidator, amount);
    }

    /// @notice Rescue tokens accidentally sent to this contract
    /// @dev Cannot rescue USDC to prevent draining liquidation proceeds (H-05 fix)
    function rescueTokens(address token, uint256 amount, address to) external onlyRole(ADMIN_ROLE) {
        require(token != usdc, "Cannot rescue USDC");
        IERC20(token).safeTransfer(to, amount);
        emit TokensRescued(token, amount, to);
    }
}
