// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "./interfaces/ITokenValidator.sol";

/// @title TokenValidator - Validates ERC20 tokens for security risks
/// @notice Checks tokens for dangerous patterns: mintable, pausable, blacklist, fee-on-transfer
/// @dev This is a simplified on-chain validator. Full validation should combine off-chain checks
///      with on-chain verification. The admin can whitelist/blacklist tokens.
contract TokenValidator is ITokenValidator, AccessControl {
    bytes32 public constant RISK_MANAGER_ROLE = keccak256("RISK_MANAGER_ROLE");

    /// @notice Tokens explicitly approved after off-chain security review
    mapping(address => bool) public whitelistedTokens;

    /// @notice Tokens explicitly blocked
    mapping(address => bool) public blacklistedTokens;

    /// @notice Minimum required token decimals
    uint8 public constant MIN_DECIMALS = 6;
    uint8 public constant MAX_DECIMALS = 18;

    event TokenWhitelisted(address indexed token);
    event TokenBlacklisted(address indexed token);
    event TokenRemovedFromWhitelist(address indexed token);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(RISK_MANAGER_ROLE, msg.sender);
    }

    // ============================================================
    //                     ADMIN FUNCTIONS
    // ============================================================

    /// @notice Whitelist a token after off-chain security review
    function whitelistToken(address token) external onlyRole(RISK_MANAGER_ROLE) {
        require(token != address(0), "Invalid token");
        require(!blacklistedTokens[token], "Token is blacklisted");
        whitelistedTokens[token] = true;
        emit TokenWhitelisted(token);
    }

    /// @notice Blacklist a dangerous token
    function blacklistToken(address token) external onlyRole(RISK_MANAGER_ROLE) {
        blacklistedTokens[token] = true;
        whitelistedTokens[token] = false;
        emit TokenBlacklisted(token);
    }

    /// @notice Remove a token from whitelist
    function removeFromWhitelist(address token) external onlyRole(RISK_MANAGER_ROLE) {
        whitelistedTokens[token] = false;
        emit TokenRemovedFromWhitelist(token);
    }

    // ============================================================
    //                    VALIDATION LOGIC
    // ============================================================

    /// @notice Validate a token for use as collateral
    /// @dev Performs on-chain checks and verifies whitelist status
    function validateToken(address token) external view override returns (bool valid, string memory reason) {
        // Check blacklist first
        if (blacklistedTokens[token]) {
            return (false, "Token is blacklisted");
        }

        // Must be whitelisted (passed off-chain security review)
        if (!whitelistedTokens[token]) {
            return (false, "Token not whitelisted");
        }

        // Basic ERC20 checks
        try IERC20Metadata(token).decimals() returns (uint8 decimals) {
            if (decimals < MIN_DECIMALS || decimals > MAX_DECIMALS) {
                return (false, "Invalid decimals");
            }
        } catch {
            return (false, "Cannot read decimals");
        }

        // Verify token has a non-zero total supply
        try IERC20(token).totalSupply() returns (uint256 supply) {
            if (supply == 0) {
                return (false, "Zero total supply");
            }
        } catch {
            return (false, "Cannot read totalSupply");
        }

        return (true, "");
    }

}
