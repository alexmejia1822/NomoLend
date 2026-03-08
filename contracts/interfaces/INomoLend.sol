// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title INomoLend - Core type definitions for the NomoLend protocol
/// @notice Shared enums and structs used across all protocol contracts
interface INomoLend {
    // ============================================================
    //                          ENUMS
    // ============================================================

    enum OrderStatus {
        OPEN,       // Order is open and can be filled
        FILLED,     // Order fully filled
        CANCELLED   // Order cancelled by creator
    }

    enum LoanStatus {
        ACTIVE,     // Loan is active
        REPAID,     // Loan was repaid
        LIQUIDATED  // Loan was liquidated (includes expired loans)
    }

    enum Duration {
        SEVEN_DAYS,    // 7 days  -> 2% interest
        FOURTEEN_DAYS, // 14 days -> 4% interest
        THIRTY_DAYS    // 30 days -> 8% interest
    }

    // ============================================================
    //                        STRUCTS
    // ============================================================

    /// @notice A lender's offer to lend USDC
    struct LendingOrder {
        address lender;
        uint256 totalAmount;       // Total USDC offered
        uint256 availableAmount;   // USDC still available
        Duration duration;         // Loan duration bracket
        OrderStatus status;
        uint256 createdAt;
    }

    /// @notice A borrower's request for a USDC loan
    struct BorrowRequest {
        address borrower;
        uint256 requestedAmount;   // Total USDC requested
        uint256 filledAmount;      // USDC already filled
        address collateralToken;   // ERC20 token used as collateral
        uint256 collateralAmount;  // Total collateral deposited
        uint256 collateralAllocated; // Actual collateral transferred out via fills (M-3-01)
        Duration duration;         // Desired loan duration
        OrderStatus status;
        uint256 createdAt;
    }

    /// @notice An active loan created from matching orders
    struct Loan {
        uint256 loanId;
        address lender;
        address borrower;
        uint256 principal;          // USDC borrowed
        address collateralToken;
        uint256 collateralAmount;
        uint256 startTimestamp;
        Duration duration;
        LoanStatus status;
        uint256 interestPaid;       // Interest paid on repayment
        uint256 repaidAt;
    }

    /// @notice Risk parameters for a collateral token
    struct TokenRiskParams {
        uint256 ltvBps;                  // Loan-to-value in basis points (e.g., 4000 = 40%)
        uint256 liquidationThresholdBps; // Liquidation threshold in bps
        uint256 maxExposure;             // Max total USDC exposure for this token
        bool isActive;                   // Whether this token is accepted
    }

    // ============================================================
    //                         EVENTS
    // ============================================================

    event LendingOrderCreated(uint256 indexed orderId, address indexed lender, uint256 amount, Duration duration);
    event LendingOrderFilled(uint256 indexed orderId, address indexed lender);
    event LendingOrderCancelled(uint256 indexed orderId);
    event BorrowRequestCreated(uint256 indexed requestId, address indexed borrower, uint256 amount, address collateralToken);
    event BorrowRequestCancelled(uint256 indexed requestId);
    event LoanCreated(uint256 indexed loanId, address indexed lender, address indexed borrower, uint256 principal, address collateralToken);
    event LoanRepaid(uint256 indexed loanId, uint256 principal, uint256 interest, uint256 platformFee);
    event LoanLiquidated(uint256 indexed loanId, uint256 collateralSold, uint256 debtRecovered, uint256 returnedToBorrower);
    event TokenPaused(address indexed token, string reason);
    event TokenUnpaused(address indexed token);
}
