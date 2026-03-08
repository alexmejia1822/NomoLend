// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IPriceOracle - Price feed interface for the NomoLend protocol
interface IPriceOracle {
    /// @notice Get the price of a token in USDC (6 decimals)
    /// @param token The token address
    /// @return price The price in USDC with 6 decimals (1 USDC = 1_000_000)
    /// @return confidence Whether the price is considered reliable
    function getPrice(address token) external view returns (uint256 price, bool confidence);

    /// @notice Get the USD value of a given token amount
    /// @param token The token address
    /// @param amount The token amount (in token decimals)
    /// @return valueInUsdc The value in USDC (6 decimals)
    function getValueInUsdc(address token, uint256 amount) external view returns (uint256 valueInUsdc);
}
