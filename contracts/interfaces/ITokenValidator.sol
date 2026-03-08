// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ITokenValidator - Validates tokens for security risks
interface ITokenValidator {
    /// @notice Check if a token passes security validation
    /// @param token The token address to validate
    /// @return valid Whether the token is valid
    /// @return reason Reason string if invalid
    function validateToken(address token) external view returns (bool valid, string memory reason);
}
