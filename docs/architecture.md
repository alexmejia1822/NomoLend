# NomoLend Architecture

## System Overview

NomoLend is built on a modular architecture with **10 core contracts** and **4 DEX adapter contracts**, each with a single responsibility. Contracts communicate through well-defined interfaces and role-based access control. No contract has unrestricted access to another -- all cross-contract calls are gated by OpenZeppelin `AccessControl` roles.

---

## Full System Architecture

```
+-----------------------------------------------------------------------------------+
|                              FRONTEND (Next.js 14)                                |
|   Dashboard | Lend | Borrow | My Loans | Risk | Analytics | Admin                |
|   wagmi 2 + RainbowKit 2 + TypeScript + Tailwind CSS                              |
+--------------------------------------+--------------------------------------------+
                                       |
                                       | JSON-RPC (read/write via wallet)
                                       |
+======================================v============================================+
|                          BASE MAINNET (Chain ID: 8453)                            |
|                                                                                   |
|  +-----------------------+                                                        |
|  |    ProtocolConfig     |  Central registry: USDC address, treasury,             |
|  |  (AccessControl)      |  DEX routers (with 24h timelock), contract registry    |
|  +--+----+----------+---+                                                        |
|     |    |          |                                                             |
|     |    |          +-----------------------------+                               |
|     |    |                                        |                               |
|  +--v----v---------+    +--------------------+    |    +-----------------------+  |
|  |  TokenValidator  |    |    PriceOracle     |    |    |     RiskGuardian      |  |
|  | (AccessControl)  |    | (AccessControl)    |    |    |  (AccessControl)      |  |
|  |                  |    |                    |    |    |                       |  |
|  | - whitelist      |    | - Chainlink feeds  |    |    | - pause tokens        |  |
|  | - blacklist      |    | - TWAP fallback    |    |    | - reduce LTV          |  |
|  | - decimals check |    | - deviation check  |    |    | - disable tokens      |  |
|  | - supply check   |    | - staleness guard  |    |    | (emergency only)      |  |
|  +--------+---------+    +---+----+-----------+    |    +----------+------------+  |
|           |                  |    |                 |               |               |
|           v                  v    |                 |               v               |
|  +--------+------------------+----+---------+      |    +---------+------------+   |
|  |              RiskEngine                   |<-----+    |  Calls RiskEngine    |   |
|  |          (AccessControl)                  |           |  with limited powers |   |
|  |                                           |           +----------------------+   |
|  | - per-token LTV & liquidation thresholds  |                                      |
|  | - exposure tracking & limits              |                                      |
|  | - circuit breaker (30%+ price drop)       |                                      |
|  | - borrowing surge detection               |                                      |
|  | - DEX liquidity requirements              |                                      |
|  | - user loan count limits (DOS protection) |                                      |
|  +----+-----+---+---------------------------+                                      |
|       |     |   |                                                                   |
|       |     |   +--------------------------------------------------+               |
|       |     |                                                      |               |
|  +----v-----v-----------+      +----------------------------------v-----------+    |
|  |  CollateralManager    |      |              OrderBook                       |    |
|  |  (ReentrancyGuard,   |      |  (ReentrancyGuard, Pausable, AccessControl)  |    |
|  |   AccessControl)     |      |                                              |    |
|  |                      |      | - lending orders (lender deposits USDC)      |    |
|  | - lock collateral    |      | - borrow requests (borrower deposits         |    |
|  | - release on repay   |      |   collateral upfront)                        |    |
|  | - release for        |      | - partial fills for both sides               |    |
|  |   liquidation        |      | - cancellation with refund                   |    |
|  | - fee-on-transfer    |      | - DOS protection (max orders per user)       |    |
|  |   protection         |      +---+---------------------------+--------------+    |
|  | - rescue stuck       |          |                           |                   |
|  |   tokens             |          |                           |                   |
|  +------+--------+------+      +---v---------------------------v--------------+    |
|         |        |              |              LoanManager                     |    |
|         |        |              |  (ReentrancyGuard, Pausable, AccessControl)  |    |
|         |        |              |                                              |    |
|         |        +--------------+  - takeLoan() from lending orders            |    |
|         |                       |  - fillBorrowRequest() from borrow requests  |    |
|         |                       |  - repayLoan() with bracket interest         |    |
|         |                       |  - liquidateLoan() (bot or public)           |    |
|         |                       |  - 4-hour grace period after expiry          |    |
|         |                       |  - min loan amount: 10 USDC                  |    |
|         |                       |  - reserve fund fee split                    |    |
|         |                       +---+---------------------------+--------------+    |
|         |                           |                           |                   |
|  +------v---------------------------v------+     +--------------v--------------+    |
|  |         LiquidationEngine               |     |         ReserveFund         |    |
|  |  (ReentrancyGuard, AccessControl)       |     |      (AccessControl)       |    |
|  |                                         |     |                            |    |
|  | - primary router swap (Uniswap V3)      |     | - accumulates 20% of      |    |
|  | - fallback router swap (Aerodrome)      |     |   platform fees            |    |
|  | - slippage protection (5% max)          |     | - coverBadDebt()           |    |
|  | - proceed distribution:                 |     |   (governance only)        |    |
|  |   1. platform fee -> treasury           |     | - getReserveBalance()      |    |
|  |   2. debt -> lender                     |     +----------------------------+    |
|  |   3. surplus -> borrower                |                                       |
|  | - public liquidator bonus (1%)          |                                       |
|  +----+--------+--------+---------+-------+                                       |
|       |        |        |         |                                                |
|  +----v---+ +--v------+ +-v------+ +--v-----------------+                          |
|  |Uniswap | |Aerodrome| |Aero CL | |Aerodrome Multihop  |                          |
|  |V3      | |Adapter  | |Adapter | |Adapter             |                          |
|  |Adapter | |         | |        | |                    |                          |
|  |        | |single-  | |conc.   | |TOKEN->WETH->USDC   |                          |
|  |0.3%    | |hop AMM  | |liq.    | |2-hop routing       |                          |
|  |default | |pools    | |pools   | |for illiquid tokens  |                          |
|  +--------+ +---------+ +--------+ +--------------------+                          |
|                                                                                    |
+====================================================================================+
                                       |
                                       | ethers.js v6 (JSON-RPC)
                                       |
+--------------------------------------v--------------------------------------------+
|                          KEEPER BOTS (PM2 + Node.js)                              |
|                                                                                   |
|  +------------------+  +-------------------+  +-----------------+  +------------+ |
|  | priceUpdater.js  |  | liquidationBot.js |  | monitorBot.js   |  | healthAPI  | |
|  | (every 5 min)    |  | (every 2 min)     |  | (every 2 min)   |  | (:4040)    | |
|  |                  |  |                   |  |                 |  |            | |
|  | CoinGecko +      |  | Scan active loans |  | Oracle health   |  | HTTP GET   | |
|  | DEX prices       |  | Check health      |  | Reserve balance |  | /health    | |
|  | -> on-chain TWAP |  | Execute           |  | DEX router      |  | Telegram   | |
|  |                  |  | liquidations      |  | Watchdog        |  | reports    | |
|  +------------------+  +-------------------+  +-----------------+  +------------+ |
|                                                                                   |
|  Shared: rpcProvider.js (multi-endpoint RPC failover) + alerts.js (Telegram)      |
+-----------------------------------------------------------------------------------+
```

---

## Contract Descriptions

### ProtocolConfig

The central configuration hub for the entire protocol. It stores the USDC token address, treasury wallet, primary and fallback DEX router addresses, and a general-purpose contract registry. Router changes are protected by a **24-hour timelock** -- any change must be proposed, waited on, and then executed in a separate transaction. This prevents instant redirect attacks where a compromised admin key could point the liquidation engine to a malicious router.

ProtocolConfig also defines protocol-wide constants: the 10% platform fee (1000 bps), the 2% expiry penalty for liquidated expired loans (200 bps), and the 5% maximum liquidation slippage (500 bps).

### TokenValidator

The gatekeeper for collateral token acceptance. It maintains whitelist and blacklist mappings that govern which ERC-20 tokens can be used as collateral. Before any token is accepted, it must pass both an off-chain security review (resulting in whitelisting) and on-chain validation checks: valid decimal count (6-18), non-zero total supply, and absence from the blacklist.

The contract enforces a conservative "deny by default" model -- tokens must be explicitly whitelisted before they can be used.

### PriceOracle

A hybrid oracle system that combines Chainlink price feeds (primary) with off-chain TWAP prices (fallback). For each supported token, the oracle stores both a Chainlink aggregator address and a keeper-updated TWAP price. When both sources are available, the oracle uses Chainlink as the authoritative price but checks that the two sources agree within a configurable deviation threshold (default 5%). If they disagree, the price is flagged as low-confidence, which blocks new loan creation.

Key safety mechanisms include: maximum 10% price change per TWAP update (prevents keeper manipulation), 5-minute cooldown between updates (prevents rapid price attacks), 25-hour staleness threshold for both sources, and Chainlink round completeness verification.

### RiskEngine

The risk assessment core of the protocol. It manages per-token risk parameters (LTV ratios, liquidation thresholds, maximum exposure caps), tracks current protocol exposure per token, and implements multiple anomaly detection mechanisms.

**Circuit breaker**: If a token's price drops by 30% or more from its recorded snapshot, the circuit breaker automatically pauses that token for new borrowing. **Surge detection**: If borrowing against a single token exceeds 50,000 USDC within a 1-hour window, the token is auto-paused. **Liquidity requirements**: Tokens can have minimum DEX liquidity requirements, and individual loans are capped at 15% of available DEX liquidity. **DOS protection**: Each user is limited to 5 active loans per collateral token.

### CollateralManager

The secure custody contract for all collateral tokens. When a loan is created, collateral is transferred from the borrower to this contract and locked against a specific loan ID. On repayment, collateral is released back to the borrower. On liquidation, collateral is released to the LiquidationEngine for DEX swapping.

The contract includes fee-on-transfer protection: it verifies the actual received token amount matches the expected amount, rejecting rebasing or fee-on-transfer tokens. An admin-only `rescueTokens` function allows recovery of tokens accidentally sent to the contract, but only excess tokens beyond what is tracked as locked.

### OrderBook

A two-sided order book that manages both lending orders and borrow requests. Lenders create orders by depositing USDC with a chosen duration bracket. Borrowers can either take loans from existing lending orders, or post their own borrow requests by depositing collateral upfront and waiting for a lender to fill them.

Both order types support **partial fills** -- a lending order for 1,000 USDC can be taken in multiple smaller loans. DOS protection limits each user to 20 active orders. The contract is pausable by admin for emergency situations.

### LoanManager

The central loan lifecycle manager that orchestrates all other contracts. It handles two loan creation paths: `takeLoan()` where a borrower takes from a lending order, and `fillBorrowRequest()` where a lender fills a borrower's request. It also handles repayment and liquidation.

On repayment, the contract calculates bracket-based interest, splits the platform fee between treasury (80%) and reserve fund (20%), distributes payments, and releases collateral. Loans have a **4-hour grace period** after expiry where borrowers can still repay before liquidation becomes possible. A minimum loan amount of 10 USDC prevents dust loan attacks.

Liquidation can be triggered by authorized keeper bots or, when enabled, by any public address (with a 1% liquidation bonus incentive).

### LiquidationEngine

Handles the mechanics of converting collateral tokens to USDC through DEX swaps. It implements a **primary + fallback router pattern**: swaps are first attempted through the primary router (Uniswap V3), and if that fails, automatically retried through the fallback router (Aerodrome).

After a successful swap, the engine distributes proceeds in priority order: (1) platform fee to treasury, (2) debt repayment to lender, (3) any surplus returned to borrower. If swap proceeds are insufficient to cover the full debt, the lender receives whatever is available. Token approvals are reset to zero after every swap for security.

### ReserveFund

A protocol safety net that accumulates a portion of platform fees (20% of the 10% platform fee, i.e., 2% of all interest). These funds can only be withdrawn through the `coverBadDebt()` function, which requires the GOVERNANCE_ROLE -- controlled by the multisig.

The reserve fund exists to cover extreme scenarios where liquidation proceeds are insufficient to repay the lender in full. It provides a financial backstop without requiring external insurance.

### RiskGuardian

An emergency-only contract with deliberately limited powers. It can pause token borrowing, reduce (never increase) a token's LTV ratio, and disable tokens entirely. It cannot access funds, change protocol parameters, or modify the core loan lifecycle.

The guardian enforces a minimum LTV floor of 10% to prevent accidental lockouts. It operates independently from the main admin roles, allowing a separate security team or automated system to respond to emergencies without full protocol admin access.

### DEX Adapters

Four adapter contracts normalize different DEX interfaces to a common `ISwapRouter` interface:

- **UniswapV3Adapter**: Wraps the Uniswap V3 SwapRouter02 `exactInputSingle` function. Supports per-token fee tier configuration (default 0.3%).
- **AerodromeAdapter**: Wraps the Aerodrome AMM router for single-hop volatile and stable pool swaps.
- **AerodromeCLAdapter**: Wraps the Aerodrome Slipstream (Concentrated Liquidity) router. Supports configurable tick spacing per token (default CL100).
- **AerodromeMultihopAdapter**: Supports 2-hop routing (TOKEN -> WETH -> USDC) for tokens without direct USDC liquidity pools.

All adapters implement 2-step ownership transfer and token rescue functions. They reset token approvals to zero after each swap.

---

## Dependency Graph

```
                        INomoLend (shared types)
                              |
            +-----------------+------------------+
            |                 |                  |
       OrderBook         LoanManager        RiskEngine
            |                 |                  |
            |       +---------+---------+        +--- PriceOracle
            |       |         |         |        |       |
            |  OrderBook  Collateral  Liq.    Token      +--- Chainlink
            |             Manager    Engine  Validator
            |                |         |
            |                |    +----+----+
            |                |    |    |    |
            |                | UniV3 Aero AeroCL AeroMultihop
            |                |
            +-- USDC (ERC20) +-- USDC + Collateral ERC20s
```

### Key Dependency Relationships

| Contract | Depends On | Dependency Type |
|----------|-----------|----------------|
| LoanManager | ProtocolConfig, OrderBook, CollateralManager, RiskEngine, LiquidationEngine, PriceOracle | Immutable references (set in constructor) |
| RiskEngine | PriceOracle, TokenValidator | Immutable references |
| RiskGuardian | RiskEngine | Immutable reference (calls with limited scope) |
| LiquidationEngine | ISwapRouter adapters | Configurable routers (admin-settable) |
| OrderBook | USDC | Immutable reference |
| CollateralManager | (none) | Standalone custody, called by LoanManager |
| ReserveFund | USDC | Immutable reference |
| PriceOracle | Chainlink Aggregators | Configurable per token |

---

## Data Flow Diagrams

### Loan Creation (Borrower Takes Lending Order)

```
Borrower                    LoanManager              OrderBook
   |                            |                        |
   |-- takeLoan(orderId, ...)-->|                        |
   |                            |-- fillLendingOrder --->|
   |                            |<-- filledAmount -------|
   |                            |
   |                            |-- checkCircuitBreaker --> RiskEngine
   |                            |-- validateNewLoan ----->  RiskEngine
   |                            |-- calcRequiredColl ---->  RiskEngine
   |                            |
   |                            |-- depositCollateral --> CollateralManager
   |                            |     (locks tokens)
   |                            |
   |<-- USDC transferred ------|
   |                            |
   |                            |-- addExposure -------> RiskEngine
   |                            |-- incrementLoanCount -> RiskEngine
```

### Loan Repayment

```
Borrower                    LoanManager              CollateralManager
   |                            |                        |
   |-- repayLoan(loanId) ----->|                        |
   |                            |-- calcInterest ------> InterestCalculator
   |                            |-- calcPlatformFee ---> ProtocolConfig
   |                            |
   |-- USDC (principal + ------+
   |   interest)                |
   |                            |-- USDC to lender
   |                            |-- fee to treasury
   |                            |-- fee to ReserveFund
   |                            |
   |                            |-- releaseCollateral -> CollateralManager
   |<-- collateral returned ----|                        |
   |                            |
   |                            |-- removeExposure ----> RiskEngine
```

### Liquidation

```
Keeper Bot                  LoanManager           LiquidationEngine
   |                            |                        |
   |-- liquidateLoan(id, ----->|                        |
   |   minAmountOut)           |                        |
   |                            |-- isLiquidatable? ---> RiskEngine
   |                            |   (expired or          |
   |                            |    undercollateralized) |
   |                            |                        |
   |                            |-- releaseForLiq -----> CollateralManager
   |                            |   (transfers collateral to LiqEngine)
   |                            |                        |
   |                            |-- liquidateCollateral ->|
   |                            |                        |-- swap on UniV3
   |                            |                        |   (or Aerodrome
   |                            |                        |    fallback)
   |                            |<-- usdcReceived -------|
   |                            |                        |
   |                            |-- distributeProceeds -->|
   |                            |   1. fee -> treasury   |
   |                            |   2. debt -> lender    |
   |                            |   3. surplus -> borrower
```

---

## Tech Stack Diagram

```
+-------------------------------------------------------------------+
|                         USER INTERFACE                             |
|                                                                   |
|  Browser ---- Next.js 14 ---- wagmi 2 ---- RainbowKit 2          |
|               TypeScript      viem         Wallet Connect         |
|               Tailwind CSS    React Query                         |
|               i18n (EN/ES)                                        |
+-------------------+-----------------------------------------------+
                    |
                    | HTTPS + JSON-RPC
                    |
+-------------------v-----------------------------------------------+
|                    BASE MAINNET (EVM)                              |
|                                                                   |
|  Solidity 0.8.24 ---- OpenZeppelin 5.x ---- Hardhat 2            |
|                                                                   |
|  10 Core Contracts + 4 DEX Adapters + InterestCalculator Library  |
|                                                                   |
|  External Dependencies:                                           |
|    - Chainlink Price Feeds (ETH/USD, BTC/USD, etc.)               |
|    - Uniswap V3 SwapRouter02                                      |
|    - Aerodrome Router + Slipstream CL Router                      |
|    - USDC (Circle)                                                |
+-------------------+-----------------------------------------------+
                    |
                    | ethers.js v6 (JSON-RPC with failover)
                    |
+-------------------v-----------------------------------------------+
|                    KEEPER INFRASTRUCTURE                           |
|                                                                   |
|  Node.js ---- PM2 ---- Firebase (remote toggle) ---- Telegram    |
|                                                                   |
|  4 Independent Processes:                                         |
|    priceUpdater    (5 min) -- CoinGecko API -> on-chain TWAP      |
|    liquidationBot  (2 min) -- scan loans + execute liquidations   |
|    monitorBot      (2 min) -- oracle/reserve/DEX health checks    |
|    healthServer    (always) -- HTTP :4040 + Telegram reports      |
|                                                                   |
|  Multi-RPC failover + auto-restart + file-based watchdog          |
+-------------------------------------------------------------------+
```

---

## Contract Interaction Patterns

### Role-Based Access

All cross-contract calls are gated by roles. The following table shows which roles each contract requires from its callers:

| Contract | Role | Granted To | Purpose |
|----------|------|-----------|---------|
| CollateralManager | `LOAN_MANAGER_ROLE` | LoanManager | Deposit/release collateral |
| OrderBook | `LOAN_MANAGER_ROLE` | LoanManager | Fill orders and requests |
| LiquidationEngine | `LIQUIDATOR_ROLE` | LoanManager | Execute swaps and distributions |
| RiskEngine | `RISK_MANAGER_ROLE` | LoanManager, RiskGuardian | Exposure tracking, parameter updates |
| PriceOracle | `PRICE_UPDATER_ROLE` | Bot Wallet | TWAP price updates |
| ReserveFund | `GOVERNANCE_ROLE` | Gnosis Safe | Bad debt coverage |

### Immutable vs. Configurable References

Contracts hold references to their dependencies in two ways:

- **Immutable** (set in constructor, cannot change): LoanManager holds all its dependencies immutably. RiskEngine holds PriceOracle and TokenValidator immutably. This prevents admin-key attacks that redirect contract calls.
- **Configurable** (admin-settable): LiquidationEngine routers can be changed by admin. PriceOracle feeds can be added/modified. ProtocolConfig routers require a 24-hour timelock.

### Pausability

Two contracts implement the OpenZeppelin `Pausable` pattern:

- **OrderBook**: Pausing prevents new lending orders and borrow requests. Existing orders can still be cancelled.
- **LoanManager**: Pausing prevents new loan creation. Repayment and liquidation remain functional to avoid trapping user funds.

---

## Further Reading

- [Protocol Overview](./overview.md) -- What NomoLend is, interest rates, collateral tokens
- [Contract Reference](./contracts.md) -- Detailed per-contract API documentation
