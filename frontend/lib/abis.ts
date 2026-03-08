// Simplified ABIs for frontend interaction
// Full ABIs should be generated from artifacts after deployment

export const OrderBookABI = [
  {
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "duration", type: "uint8" },
    ],
    name: "createLendingOrder",
    outputs: [{ name: "orderId", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "orderId", type: "uint256" }],
    name: "cancelLendingOrder",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "requestedAmount", type: "uint256" },
      { name: "collateralToken", type: "address" },
      { name: "collateralAmount", type: "uint256" },
      { name: "duration", type: "uint8" },
    ],
    name: "createBorrowRequest",
    outputs: [{ name: "requestId", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "requestId", type: "uint256" }],
    name: "cancelBorrowRequest",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "orderId", type: "uint256" }],
    name: "getLendingOrder",
    outputs: [
      {
        components: [
          { name: "lender", type: "address" },
          { name: "totalAmount", type: "uint256" },
          { name: "availableAmount", type: "uint256" },
          { name: "duration", type: "uint8" },
          { name: "status", type: "uint8" },
          { name: "createdAt", type: "uint256" },
        ],
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "requestId", type: "uint256" }],
    name: "getBorrowRequest",
    outputs: [
      {
        components: [
          { name: "borrower", type: "address" },
          { name: "requestedAmount", type: "uint256" },
          { name: "filledAmount", type: "uint256" },
          { name: "collateralToken", type: "address" },
          { name: "collateralAmount", type: "uint256" },
          { name: "duration", type: "uint8" },
          { name: "status", type: "uint8" },
          { name: "createdAt", type: "uint256" },
        ],
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "user", type: "address" }],
    name: "getUserLendingOrders",
    outputs: [{ name: "", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "user", type: "address" }],
    name: "getUserBorrowRequests",
    outputs: [{ name: "", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "nextLendingOrderId",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "nextBorrowRequestId",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const LoanManagerABI = [
  {
    inputs: [
      { name: "lendingOrderId", type: "uint256" },
      { name: "amount", type: "uint256" },
      { name: "collateralToken", type: "address" },
      { name: "collateralAmount", type: "uint256" },
    ],
    name: "takeLoan",
    outputs: [{ name: "loanId", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "borrowRequestId", type: "uint256" },
      { name: "amount", type: "uint256" },
    ],
    name: "fillBorrowRequest",
    outputs: [{ name: "loanId", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "loanId", type: "uint256" }],
    name: "repayLoan",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "loanId", type: "uint256" }],
    name: "getLoan",
    outputs: [
      {
        components: [
          { name: "loanId", type: "uint256" },
          { name: "lender", type: "address" },
          { name: "borrower", type: "address" },
          { name: "principal", type: "uint256" },
          { name: "collateralToken", type: "address" },
          { name: "collateralAmount", type: "uint256" },
          { name: "startTimestamp", type: "uint256" },
          { name: "duration", type: "uint8" },
          { name: "status", type: "uint8" },
          { name: "interestPaid", type: "uint256" },
          { name: "repaidAt", type: "uint256" },
        ],
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "loanId", type: "uint256" }],
    name: "getCurrentDebt",
    outputs: [
      { name: "totalDebt", type: "uint256" },
      { name: "interest", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "loanId", type: "uint256" }],
    name: "getLoanHealthFactor",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "loanId", type: "uint256" }],
    name: "isLoanLiquidatable",
    outputs: [
      { name: "expired", type: "bool" },
      { name: "undercollateralized", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "borrower", type: "address" }],
    name: "getBorrowerLoans",
    outputs: [{ name: "", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "lender", type: "address" }],
    name: "getLenderLoans",
    outputs: [{ name: "", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const RiskEngineABI = [
  {
    inputs: [{ name: "token", type: "address" }],
    name: "tokenRiskParams",
    outputs: [
      { name: "ltvBps", type: "uint256" },
      { name: "liquidationThresholdBps", type: "uint256" },
      { name: "maxExposure", type: "uint256" },
      { name: "isActive", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "token", type: "address" }],
    name: "currentExposure",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "token", type: "address" },
      { name: "loanAmountUsdc", type: "uint256" },
    ],
    name: "calculateRequiredCollateral",
    outputs: [{ name: "requiredCollateral", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const PriceOracleABI = [
  {
    inputs: [{ name: "token", type: "address" }],
    name: "getPrice",
    outputs: [
      { name: "price", type: "uint256" },
      { name: "confidence", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "getValueInUsdc",
    outputs: [{ name: "valueInUsdc", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// Admin ABIs for token management
export const TokenValidatorAdminABI = [
  {
    inputs: [{ name: "token", type: "address" }],
    name: "whitelistToken",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "token", type: "address" }],
    name: "whitelistedTokens",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const PriceOracleAdminABI = [
  {
    inputs: [
      { name: "token", type: "address" },
      { name: "chainlinkFeed", type: "address" },
      { name: "tokenDecimals", type: "uint8" },
    ],
    name: "setPriceFeed",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "token", type: "address" },
      { name: "price", type: "uint256" },
    ],
    name: "updateTwapPrice",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

export const RiskEngineAdminABI = [
  {
    inputs: [
      { name: "token", type: "address" },
      { name: "ltvBps", type: "uint256" },
      { name: "liquidationThresholdBps", type: "uint256" },
      { name: "maxExposure", type: "uint256" },
    ],
    name: "setTokenRiskParams",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

export const CollateralManagerABI = [
  {
    inputs: [{ name: "token", type: "address" }],
    name: "totalCollateral",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const LoanManagerNextIdABI = [
  {
    inputs: [],
    name: "nextLoanId",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const ERC20ABI = [
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
] as const;
