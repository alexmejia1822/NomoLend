// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./RiskEngine.sol";

/// @title RiskGuardian - Emergency risk controller for NomoLend
/// @notice Provides limited risk parameter controls without fund access
///         Guardian can only pause tokens, reduce LTV, and disable tokens
contract RiskGuardian is AccessControl {
    bytes32 public constant RISK_GUARDIAN_ROLE = keccak256("RISK_GUARDIAN_ROLE");

    RiskEngine public immutable riskEngine;

    event GuardianActionExecuted(string action, address indexed token, address indexed guardian);

    constructor(address _riskEngine) {
        require(_riskEngine != address(0), "Invalid RiskEngine");
        riskEngine = RiskEngine(_riskEngine);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(RISK_GUARDIAN_ROLE, msg.sender);
    }

    /// @notice Pause borrowing for a token
    function pauseTokenBorrowing(address token, string calldata reason) external onlyRole(RISK_GUARDIAN_ROLE) {
        riskEngine.setTokenPaused(token, true, reason);
        emit GuardianActionExecuted("pauseToken", token, msg.sender);
    }

    /// @notice Unpause borrowing for a token
    function unpauseTokenBorrowing(address token) external onlyRole(RISK_GUARDIAN_ROLE) {
        riskEngine.setTokenPaused(token, false, "");
        emit GuardianActionExecuted("unpauseToken", token, msg.sender);
    }

    /// @notice Reduce LTV for a token (can only decrease, never increase)
    /// @dev M-5-03: enforces minimum LTV floor of 10% to prevent accidental lockout
    function reduceTokenLTV(address token, uint256 newLtvBps) external onlyRole(RISK_GUARDIAN_ROLE) {
        (uint256 currentLtv, uint256 liqThreshold, uint256 maxExp,) = riskEngine.tokenRiskParams(token);
        require(newLtvBps >= 1000, "Min LTV is 10%");
        require(newLtvBps < currentLtv, "Can only reduce LTV");
        riskEngine.setTokenRiskParams(token, newLtvBps, liqThreshold, maxExp);
        emit GuardianActionExecuted("reduceLTV", token, msg.sender);
    }

    /// @notice Disable a token entirely (no new loans)
    function disableToken(address token) external onlyRole(RISK_GUARDIAN_ROLE) {
        riskEngine.deactivateToken(token);
        emit GuardianActionExecuted("disableToken", token, msg.sender);
    }
}
