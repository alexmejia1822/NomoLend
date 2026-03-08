// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/ISwapRouter.sol";

/// @notice Aerodrome Slipstream (CL) SwapRouter interface
interface ICLSwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        int24 tickSpacing;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params)
        external
        payable
        returns (uint256 amountOut);
}

/// @title AerodromeCLAdapter - Wraps Aerodrome Slipstream CL Router to ISwapRouter
/// @notice For Concentrated Liquidity pools (CL1, CL50, CL100, CL200, etc.)
contract AerodromeCLAdapter is ISwapRouter {
    using SafeERC20 for IERC20;

    ICLSwapRouter public immutable clRouter;

    /// @notice Default tick spacing (CL100 = 100)
    int24 public constant DEFAULT_TICK_SPACING = 100;

    /// @notice Custom tick spacing per token (tokenIn => tickSpacing)
    mapping(address => int24) public customTickSpacing;

    address public owner;
    address public pendingOwner;

    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(address _clRouter) {
        require(_clRouter != address(0), "Invalid router");
        clRouter = ICLSwapRouter(_clRouter);
        owner = msg.sender;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    function acceptOwnership() external {
        require(msg.sender == pendingOwner, "Not pending owner");
        emit OwnershipTransferred(owner, pendingOwner);
        owner = pendingOwner;
        pendingOwner = address(0);
    }

    function setCustomTickSpacing(address token, int24 tickSpacing) external onlyOwner {
        customTickSpacing[token] = tickSpacing;
    }

    /// @notice Execute swap via Aerodrome CL (Slipstream)
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient
    ) external override returns (uint256 amountOut) {
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenIn).forceApprove(address(clRouter), amountIn);

        int24 tickSpacing = customTickSpacing[tokenIn];
        if (tickSpacing == 0) tickSpacing = DEFAULT_TICK_SPACING;

        amountOut = clRouter.exactInputSingle(
            ICLSwapRouter.ExactInputSingleParams({
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                tickSpacing: tickSpacing,
                recipient: recipient,
                deadline: block.timestamp + 300,
                amountIn: amountIn,
                amountOutMinimum: minAmountOut,
                sqrtPriceLimitX96: 0
            })
        );

        IERC20(tokenIn).forceApprove(address(clRouter), 0);
    }

    function rescueTokens(address token, uint256 amount, address to) external onlyOwner {
        require(to != address(0), "Invalid recipient");
        IERC20(token).safeTransfer(to, amount);
    }
}
