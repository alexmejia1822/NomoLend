// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/// @title CollateralManager - Secure custody and release of collateral tokens
/// @notice Holds all collateral for active loans. Only authorized contracts can deposit/withdraw.
contract CollateralManager is ReentrancyGuard, AccessControl {
    using SafeERC20 for IERC20;

    bytes32 public constant LOAN_MANAGER_ROLE = keccak256("LOAN_MANAGER_ROLE");

    /// @notice loanId => token => amount locked
    mapping(uint256 => mapping(address => uint256)) public lockedCollateral;

    /// @notice Total collateral held per token (for transparency)
    mapping(address => uint256) public totalCollateral;

    // ============================================================
    //                         EVENTS
    // ============================================================

    event CollateralDeposited(uint256 indexed loanId, address indexed token, uint256 amount);
    event CollateralReleased(uint256 indexed loanId, address indexed token, uint256 amount, address indexed recipient);
    event TokensRescued(address indexed token, uint256 amount, address indexed to);

    // ============================================================
    //                       CONSTRUCTOR
    // ============================================================

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // ============================================================
    //                   COLLATERAL OPERATIONS
    // ============================================================

    /// @notice Deposit collateral for a loan (called by LoanManager)
    /// @dev Tokens must be transferred to this contract before calling
    function depositCollateral(
        uint256 loanId,
        address token,
        uint256 amount,
        address from
    ) external onlyRole(LOAN_MANAGER_ROLE) nonReentrant {
        require(amount > 0, "Amount must be > 0");

        // Fee-on-transfer protection: verify actual received amount
        uint256 balanceBefore = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransferFrom(from, address(this), amount);
        uint256 received = IERC20(token).balanceOf(address(this)) - balanceBefore;
        require(received == amount, "Fee-on-transfer tokens not supported");

        lockedCollateral[loanId][token] += amount;
        totalCollateral[token] += amount;

        emit CollateralDeposited(loanId, token, amount);
    }

    /// @notice Release collateral back to borrower (after repayment)
    function releaseCollateral(
        uint256 loanId,
        address token,
        uint256 amount,
        address recipient
    ) external onlyRole(LOAN_MANAGER_ROLE) nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(lockedCollateral[loanId][token] >= amount, "Insufficient locked collateral");
        require(recipient != address(0), "Invalid recipient");

        lockedCollateral[loanId][token] -= amount;
        totalCollateral[token] -= amount;

        IERC20(token).safeTransfer(recipient, amount);

        emit CollateralReleased(loanId, token, amount, recipient);
    }

    /// @notice Release all collateral for a loan to the liquidation engine
    function releaseForLiquidation(
        uint256 loanId,
        address token,
        address liquidationEngine
    ) external onlyRole(LOAN_MANAGER_ROLE) nonReentrant returns (uint256 amount) {
        amount = lockedCollateral[loanId][token];
        require(amount > 0, "No collateral to liquidate");
        require(liquidationEngine != address(0), "Invalid liquidation engine");

        lockedCollateral[loanId][token] = 0;
        totalCollateral[token] -= amount;

        IERC20(token).safeTransfer(liquidationEngine, amount);

        emit CollateralReleased(loanId, token, amount, liquidationEngine);
    }

    // ============================================================
    //                    ADMIN FUNCTIONS
    // ============================================================

    /// @notice Rescue tokens accidentally sent to this contract (L-3-05)
    /// @dev Only allows rescuing excess tokens beyond what's tracked as locked
    function rescueTokens(address token, uint256 amount, address to) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(to != address(0), "Invalid recipient");
        uint256 balance = IERC20(token).balanceOf(address(this));
        uint256 locked = totalCollateral[token];
        require(balance >= locked + amount, "Cannot rescue locked collateral");
        IERC20(token).safeTransfer(to, amount);
        emit TokensRescued(token, amount, to);
    }

    // ============================================================
    //                      VIEW FUNCTIONS
    // ============================================================

    function getLockedCollateral(uint256 loanId, address token) external view returns (uint256) {
        return lockedCollateral[loanId][token];
    }
}
