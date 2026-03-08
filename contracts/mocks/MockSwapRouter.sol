// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/ISwapRouter.sol";

/// @title MockSwapRouter - Simulates DEX swap for testing
/// @dev Returns a configurable exchange rate
contract MockSwapRouter is ISwapRouter {
    using SafeERC20 for IERC20;

    /// @notice Exchange rate: how many tokenOut per tokenIn (in tokenOut decimals, per 1e18 tokenIn)
    mapping(address => mapping(address => uint256)) public exchangeRates;

    bool public shouldFail;

    function setExchangeRate(address tokenIn, address tokenOut, uint256 rate) external {
        exchangeRates[tokenIn][tokenOut] = rate;
    }

    function setShouldFail(bool _fail) external {
        shouldFail = _fail;
    }

    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient
    ) external override returns (uint256 amountOut) {
        require(!shouldFail, "MockSwapRouter: forced failure");

        uint256 rate = exchangeRates[tokenIn][tokenOut];
        require(rate > 0, "MockSwapRouter: no rate set");

        // Calculate output: amountIn * rate / 1e18
        amountOut = (amountIn * rate) / 1e18;
        require(amountOut >= minAmountOut, "MockSwapRouter: slippage exceeded");

        // Take input tokens
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);

        // Send output tokens
        IERC20(tokenOut).safeTransfer(recipient, amountOut);
    }
}
