// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ISwapRouter - Interface for DEX swap execution
interface ISwapRouter {
    /// @notice Execute a swap from tokenIn to tokenOut
    /// @param tokenIn The input token
    /// @param tokenOut The output token
    /// @param amountIn The amount of tokenIn to swap
    /// @param minAmountOut The minimum acceptable output amount (slippage protection)
    /// @param recipient The address to receive the output tokens
    /// @return amountOut The actual amount of tokenOut received
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient
    ) external returns (uint256 amountOut);
}
