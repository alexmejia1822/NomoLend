// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/// @title ReserveFund - Protocol safety reserve for NomoLend
/// @notice Accumulates a portion of protocol fees to cover extreme liquidation losses
///         Funds can only be used through governance (coverBadDebt)
contract ReserveFund is AccessControl {
    using SafeERC20 for IERC20;

    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");

    IERC20 public immutable usdc;

    event ReserveDeposited(uint256 amount, address indexed from);
    event BadDebtCovered(uint256 amount, address indexed recipient);
    event ReserveFundUsed(uint256 amount, string reason);

    constructor(address _usdc) {
        require(_usdc != address(0), "Invalid USDC");
        usdc = IERC20(_usdc);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(GOVERNANCE_ROLE, msg.sender);
    }

    /// @notice Cover bad debt from reserve (governance only)
    function coverBadDebt(uint256 amount, address recipient, string calldata reason) external onlyRole(GOVERNANCE_ROLE) {
        require(recipient != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be > 0");
        require(usdc.balanceOf(address(this)) >= amount, "Insufficient reserve");
        usdc.safeTransfer(recipient, amount);
        emit BadDebtCovered(amount, recipient);
        emit ReserveFundUsed(amount, reason);
    }

    /// @notice Get current reserve balance
    function getReserveBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }
}
