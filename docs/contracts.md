# NomoLend Contract Reference

This document provides detailed technical documentation for every deployed contract in the NomoLend protocol. Each section covers the contract's purpose, deployed address, inheritance chain, access control roles, public functions, events, and constants.

All contracts are deployed on **Base Mainnet** (Chain ID: 8453) and compiled with **Solidity 0.8.24**.

---

## Table of Contents

- [ProtocolConfig](#protocolconfig)
- [TokenValidator](#tokenvalidator)
- [PriceOracle](#priceoracle)
- [RiskEngine](#riskengine)
- [CollateralManager](#collateralmanager)
- [OrderBook](#orderbook)
- [LoanManager](#loanmanager)
- [LiquidationEngine](#liquidationengine)
- [ReserveFund](#reservefund)
- [RiskGuardian](#riskguardian)
- [UniswapV3Adapter](#uniswapv3adapter)
- [AerodromeAdapter](#aerodromeadapter)
- [AerodromeCLAdapter](#aerodromecladapter)
- [AerodromeMultihopAdapter](#aerodromemultihopadapter)
- [InterestCalculator (Library)](#interestcalculator-library)
- [Interfaces](#interfaces)

---

## ProtocolConfig

Central configuration and access control hub for the NomoLend protocol. Manages USDC address, treasury, DEX routers (with 24-hour timelock), and a contract registry.

| Property | Value |
|----------|-------|
| **Address** | [`0x0a41e67c838192944F0F7FA93943b48c517af20e`](https://basescan.org/address/0x0a41e67c838192944F0F7FA93943b48c517af20e) |
| **Inherits** | `AccessControl` |
| **Source** | `contracts/ProtocolConfig.sol` |

### Roles

| Role | Purpose |
|------|---------|
| `DEFAULT_ADMIN_ROLE` | Can grant/revoke all roles |
| `ADMIN_ROLE` | Set treasury, propose/execute router changes, register contracts |
| `RISK_MANAGER_ROLE` | Granted at construction (used by other contracts) |

### Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `PLATFORM_FEE_BPS` | 1000 | 10% platform fee on interest |
| `BPS_DENOMINATOR` | 10,000 | Basis points denominator |
| `EXPIRY_PENALTY_BPS` | 200 | 2% penalty for expired loans |
| `MAX_LIQUIDATION_SLIPPAGE_BPS` | 500 | 5% max slippage on liquidation swaps |
| `ROUTER_TIMELOCK` | 24 hours | Delay for router changes |

### State Variables

| Variable | Type | Description |
|----------|------|-------------|
| `usdc` | `address` (immutable) | USDC token address on Base |
| `treasury` | `address` | Treasury that collects platform fees |
| `primaryRouter` | `address` | Primary DEX router (Uniswap V3) |
| `fallbackRouter` | `address` | Fallback DEX router (Aerodrome) |
| `contracts` | `mapping(bytes32 => address)` | Contract registry |
| `pendingPrimaryRouter` | `PendingRouter` | Pending primary router change |
| `pendingFallbackRouter` | `PendingRouter` | Pending fallback router change |

### Functions

| Function | Access | Description |
|----------|--------|-------------|
| `setTreasury(address)` | ADMIN_ROLE | Update the treasury address |
| `initializeRouters(address, address)` | ADMIN_ROLE | Set routers (only when both are address(0)) |
| `proposePrimaryRouter(address)` | ADMIN_ROLE | Propose a new primary router (starts 24h timelock) |
| `executePrimaryRouter()` | ADMIN_ROLE | Execute pending primary router change (after timelock) |
| `proposeFallbackRouter(address)` | ADMIN_ROLE | Propose a new fallback router |
| `executeFallbackRouter()` | ADMIN_ROLE | Execute pending fallback router change |
| `cancelPendingRouter(string)` | ADMIN_ROLE | Cancel a pending router proposal |
| `registerContract(bytes32, address)` | ADMIN_ROLE | Register a contract in the registry |
| `getContract(bytes32)` | View | Get a registered contract address |
| `calculatePlatformFee(uint256)` | Pure | Calculate 10% platform fee from interest amount |

### Events

| Event | Parameters |
|-------|------------|
| `TreasuryUpdated` | `oldTreasury`, `newTreasury` |
| `RouterUpdated` | `routerType`, `router` |
| `RouterChangeProposed` | `routerType`, `router`, `readyAt` |
| `RouterChangeCancelled` | `routerType`, `previousProposal` |
| `ContractRegistered` | `key`, `contractAddr` |

### Interactions

- **Read by**: LoanManager (USDC address, treasury, platform fee calculation)
- **Not called by other contracts directly** -- primarily a configuration store

---

## TokenValidator

Validates ERC-20 tokens for security risks before they can be used as collateral. Implements a whitelist/blacklist model with on-chain validation checks.

| Property | Value |
|----------|-------|
| **Address** | [`0xe0CA16261405CA12F156E2F3A0B309d9587B9e4D`](https://basescan.org/address/0xe0CA16261405CA12F156E2F3A0B309d9587B9e4D) |
| **Inherits** | `ITokenValidator`, `AccessControl` |
| **Source** | `contracts/TokenValidator.sol` |

### Roles

| Role | Purpose |
|------|---------|
| `DEFAULT_ADMIN_ROLE` | Can grant/revoke all roles |
| `RISK_MANAGER_ROLE` | Whitelist, blacklist, and remove tokens |

### Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `MIN_DECIMALS` | 6 | Minimum acceptable token decimals |
| `MAX_DECIMALS` | 18 | Maximum acceptable token decimals |

### Functions

| Function | Access | Description |
|----------|--------|-------------|
| `whitelistToken(address)` | RISK_MANAGER_ROLE | Approve a token after off-chain security review |
| `blacklistToken(address)` | RISK_MANAGER_ROLE | Block a dangerous token (also removes from whitelist) |
| `removeFromWhitelist(address)` | RISK_MANAGER_ROLE | Remove a token from the whitelist |
| `validateToken(address)` | View | Validate a token: checks blacklist, whitelist, decimals, total supply |

### Events

| Event | Parameters |
|-------|------------|
| `TokenWhitelisted` | `token` |
| `TokenBlacklisted` | `token` |
| `TokenRemovedFromWhitelist` | `token` |

### Interactions

- **Called by**: RiskEngine (`validateToken` during loan validation)

---

## PriceOracle

Hybrid oracle system combining Chainlink price feeds (primary) with off-chain TWAP prices (fallback). All prices are returned in USDC units (6 decimals).

| Property | Value |
|----------|-------|
| **Address** | [`0xc8Fb5BCaC3501E060e6AFb89cd0723BCC98f1e08`](https://basescan.org/address/0xc8Fb5BCaC3501E060e6AFb89cd0723BCC98f1e08) |
| **Inherits** | `IPriceOracle`, `AccessControl` |
| **Source** | `contracts/PriceOracle.sol` |

### Roles

| Role | Purpose |
|------|---------|
| `DEFAULT_ADMIN_ROLE` | Can grant/revoke all roles |
| `ADMIN_ROLE` | Configure price feeds, set thresholds, deactivate feeds |
| `PRICE_UPDATER_ROLE` | Update TWAP prices (granted to keeper bot wallet) |

### Constants & Defaults

| Parameter | Default | Description |
|-----------|---------|-------------|
| `USDC_DECIMALS` | 6 | USDC decimal precision |
| `PRICE_PRECISION` | 1e6 | Price precision for USDC parity |
| `priceDeviationThresholdBps` | 500 (5%) | Max allowed deviation between Chainlink and TWAP |
| `maxTwapChangeBps` | 1000 (10%) | Max TWAP price change per update |
| `twapUpdateCooldown` | 5 minutes | Minimum time between TWAP updates |
| `maxPriceStaleness` | 25 hours | Max age for a price to be considered valid |

### Functions

| Function | Access | Description |
|----------|--------|-------------|
| `setPriceFeed(address, address, uint8)` | ADMIN_ROLE | Configure a price feed (token, Chainlink address, token decimals) |
| `updateTwapPrice(address, uint256)` | PRICE_UPDATER_ROLE | Update TWAP price for a single token |
| `batchUpdateTwapPrices(address[], uint256[])` | PRICE_UPDATER_ROLE | Batch update TWAP prices |
| `setMaxTwapChangeBps(uint256)` | ADMIN_ROLE | Set max TWAP change per update (1%-50%) |
| `setTwapUpdateCooldown(uint256)` | ADMIN_ROLE | Set cooldown between updates (1min-1h) |
| `deactivateFeed(address)` | ADMIN_ROLE | Deactivate a price feed |
| `setDeviationThreshold(uint256)` | ADMIN_ROLE | Set Chainlink/TWAP deviation threshold |
| `setMaxPriceStaleness(uint256)` | ADMIN_ROLE | Set max price staleness (1h-48h) |
| `getPrice(address)` | View | Get price and confidence flag for a token |
| `getValueInUsdc(address, uint256)` | View | Get USDC value of a token amount (reverts if not confident) |

### Events

| Event | Parameters |
|-------|------------|
| `PriceFeedSet` | `token`, `chainlinkFeed`, `tokenDecimals` |
| `TwapPriceUpdated` | `token`, `price`, `timestamp` |
| `TwapPriceRejected` | `token`, `newPrice`, `lastPrice` |
| `PriceFeedDeactivated` | `token` |
| `DeviationThresholdUpdated` | `newThreshold` |
| `MaxPriceStalenessUpdated` | `newStaleness` |
| `MaxTwapChangeBpsUpdated` | `newMaxChangeBps` |
| `TwapCooldownUpdated` | `newCooldown` |

### Interactions

- **Called by**: RiskEngine (`getPrice`, `getValueInUsdc` for collateral valuation)
- **Called by**: LoanManager (constructor reference)
- **Updated by**: priceUpdater.js keeper bot

---

## RiskEngine

Dynamic risk assessment engine. Manages per-token risk parameters, exposure tracking, circuit breakers, surge detection, and liquidity requirements.

| Property | Value |
|----------|-------|
| **Address** | [`0xc5E0fDDB27bB10Efb341654dAbeA55d3Cc09870F`](https://basescan.org/address/0xc5E0fDDB27bB10Efb341654dAbeA55d3Cc09870F) |
| **Inherits** | `AccessControl` |
| **Source** | `contracts/RiskEngine.sol` |

### Roles

| Role | Purpose |
|------|---------|
| `DEFAULT_ADMIN_ROLE` | Can grant/revoke all roles |
| `RISK_MANAGER_ROLE` | Set risk params, manage exposure, configure liquidity requirements |

### Key Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `surgeThresholdUsdc` | 50,000 USDC | Max borrowing per token per hour before auto-pause |
| `surgeWindowSeconds` | 1 hour | Surge detection window |
| `maxLoansPerUserPerToken` | 5 | DOS protection limit |
| `priceDropThresholdBps` | 3000 (30%) | Circuit breaker trigger threshold |
| `maxLoanToLiquidityBps` | 1500 (15%) | Max loan as % of DEX liquidity |
| `maxLiquidityStaleness` | 6 hours | Max age for DEX liquidity data |

### Functions

| Function | Access | Description |
|----------|--------|-------------|
| `setTokenRiskParams(address, uint256, uint256, uint256)` | RISK_MANAGER_ROLE | Set LTV, liquidation threshold, and max exposure for a token |
| `deactivateToken(address)` | RISK_MANAGER_ROLE | Disable a token for new loans |
| `setTokenPaused(address, bool, string)` | RISK_MANAGER_ROLE | Pause/unpause a token |
| `setSurgeThreshold(uint256)` | RISK_MANAGER_ROLE | Set borrowing surge threshold |
| `setMaxLoansPerUserPerToken(uint256)` | RISK_MANAGER_ROLE | Set DOS protection limit (1-50) |
| `validateNewLoan(address, uint256, address)` | View | Validate all risk checks for a new loan |
| `calculateRequiredCollateral(address, uint256)` | View | Calculate collateral needed for a loan amount |
| `calculateHealthFactor(address, uint256, uint256)` | View | Calculate loan health factor (10000 = 1.0) |
| `isLiquidatable(address, uint256, uint256)` | View | Check if a position is liquidatable |
| `addExposure(address, uint256)` | RISK_MANAGER_ROLE | Record new exposure on loan creation |
| `removeExposure(address, uint256)` | RISK_MANAGER_ROLE | Remove exposure on repayment/liquidation |
| `incrementUserLoanCount(address, address)` | RISK_MANAGER_ROLE | Track user loans per token |
| `decrementUserLoanCount(address, address)` | RISK_MANAGER_ROLE | Reduce user loan count |
| `checkCircuitBreaker(address)` | Public | Check and trigger circuit breaker if price dropped 30%+ |
| `setPriceDropThreshold(uint256)` | RISK_MANAGER_ROLE | Set circuit breaker threshold (5%-50%) |
| `setTokenDexLiquidity(address, uint256)` | RISK_MANAGER_ROLE | Update DEX liquidity for a token |
| `batchSetTokenDexLiquidity(address[], uint256[])` | RISK_MANAGER_ROLE | Batch update DEX liquidity |
| `setMinDexLiquidity(address, uint256)` | RISK_MANAGER_ROLE | Set minimum DEX liquidity requirement |
| `setMaxLoanToLiquidityBps(uint256)` | RISK_MANAGER_ROLE | Set max loan/liquidity ratio (0.01%-50%) |
| `setMaxLiquidityStaleness(uint256)` | RISK_MANAGER_ROLE | Set liquidity data staleness (1h-24h) |
| `getRegisteredTokens()` | View | Get all registered token addresses |
| `getTotalExposure()` | View | Get total USDC exposure across all tokens |
| `getTokenRiskSummary(address)` | View | Get full risk summary for a token |

### Events

| Event | Parameters |
|-------|------------|
| `TokenRiskParamsUpdated` | `token`, `ltvBps`, `liquidationBps`, `maxExposure` |
| `ExposureUpdated` | `token`, `newExposure` |
| `SurgeDetected` | `token`, `amountInWindow` |
| `SurgeThresholdUpdated` | `newThreshold` |
| `TokenDeactivated` | `token` |
| `CircuitBreakerTriggered` | `token`, `oldPrice`, `newPrice`, `dropBps` |
| `PriceSnapshotUpdated` | `token`, `price` |
| `LiquidityRequirementUpdated` | `token`, `minLiquidity` |
| `TokenDexLiquidityUpdated` | `token`, `liquidity` |
| `PriceDropThresholdUpdated` | `newThresholdBps` |
| `MaxLoanToLiquidityUpdated` | `newBps` |
| `MaxLiquidityStalenessUpdated` | `newStaleness` |
| `MaxLoansPerUserPerTokenUpdated` | `newMax` |

### Interactions

- **Called by**: LoanManager (validation, exposure tracking, collateral calculation, health checks)
- **Called by**: RiskGuardian (pause, reduce LTV, disable tokens)
- **Reads from**: PriceOracle, TokenValidator

---

## CollateralManager

Secure custody contract for all collateral tokens locked against active loans. Tracks collateral per loan ID and enforces fee-on-transfer protection.

| Property | Value |
|----------|-------|
| **Address** | [`0x180dcc27C5923c6FEeD4Fd4f210c6F1fE0A812c5`](https://basescan.org/address/0x180dcc27C5923c6FEeD4Fd4f210c6F1fE0A812c5) |
| **Inherits** | `ReentrancyGuard`, `AccessControl` |
| **Source** | `contracts/CollateralManager.sol` |

### Roles

| Role | Purpose |
|------|---------|
| `DEFAULT_ADMIN_ROLE` | Can grant/revoke roles, rescue stuck tokens |
| `LOAN_MANAGER_ROLE` | Deposit, release, and liquidate collateral |

### Functions

| Function | Access | Description |
|----------|--------|-------------|
| `depositCollateral(uint256, address, uint256, address)` | LOAN_MANAGER_ROLE | Deposit collateral for a loan (fee-on-transfer protection) |
| `releaseCollateral(uint256, address, uint256, address)` | LOAN_MANAGER_ROLE | Release collateral back to borrower after repayment |
| `releaseForLiquidation(uint256, address, address)` | LOAN_MANAGER_ROLE | Release all collateral for a loan to the LiquidationEngine |
| `rescueTokens(address, uint256, address)` | DEFAULT_ADMIN_ROLE | Rescue excess tokens (cannot touch locked collateral) |
| `getLockedCollateral(uint256, address)` | View | Get locked collateral amount for a loan |

### Events

| Event | Parameters |
|-------|------------|
| `CollateralDeposited` | `loanId`, `token`, `amount` |
| `CollateralReleased` | `loanId`, `token`, `amount`, `recipient` |
| `TokensRescued` | `token`, `amount`, `to` |

### Interactions

- **Called by**: LoanManager (deposit on loan creation, release on repayment, release for liquidation)

---

## OrderBook

Two-sided order book managing lending orders (USDC offers) and borrow requests (collateral-backed requests). Supports partial fills and cancellation.

| Property | Value |
|----------|-------|
| **Address** | [`0x400Abe15172CE78E51c33aE1b91F673004dB2315`](https://basescan.org/address/0x400Abe15172CE78E51c33aE1b91F673004dB2315) |
| **Inherits** | `INomoLend`, `ReentrancyGuard`, `Pausable`, `AccessControl` |
| **Source** | `contracts/OrderBook.sol` |

### Roles

| Role | Purpose |
|------|---------|
| `DEFAULT_ADMIN_ROLE` | Can grant/revoke all roles |
| `LOAN_MANAGER_ROLE` | Fill lending orders and borrow requests |
| `ADMIN_ROLE` | Set max orders per user, pause/unpause |

### Key Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `maxActiveOrdersPerUser` | 20 | DOS protection limit |

### Functions

| Function | Access | Description |
|----------|--------|-------------|
| `createLendingOrder(uint256, Duration)` | Public | Create a USDC lending offer (transfers USDC to contract) |
| `cancelLendingOrder(uint256)` | Public (owner only) | Cancel and refund an open lending order |
| `fillLendingOrder(uint256, uint256)` | LOAN_MANAGER_ROLE | Fill a lending order (partial or full) |
| `createBorrowRequest(uint256, address, uint256, Duration)` | Public | Create a borrow request with collateral deposit |
| `cancelBorrowRequest(uint256)` | Public (owner only) | Cancel and refund unallocated collateral |
| `fillBorrowRequest(uint256, uint256)` | LOAN_MANAGER_ROLE | Fill a borrow request (returns proportional collateral) |
| `setMaxActiveOrdersPerUser(uint256)` | ADMIN_ROLE | Set max orders per user (1-100) |
| `pause()` / `unpause()` | ADMIN_ROLE | Emergency pause/unpause |
| `getLendingOrder(uint256)` | View | Get lending order details |
| `getBorrowRequest(uint256)` | View | Get borrow request details |
| `getUserLendingOrders(address)` | View | Get all lending order IDs for a user |
| `getUserBorrowRequests(address)` | View | Get all borrow request IDs for a user |
| `getUserLendingOrdersPaginated(address, uint256, uint256)` | View | Paginated lending orders |
| `getUserBorrowRequestsPaginated(address, uint256, uint256)` | View | Paginated borrow requests |

### Events

Inherited from `INomoLend`:

| Event | Parameters |
|-------|------------|
| `LendingOrderCreated` | `orderId`, `lender`, `amount`, `duration` |
| `LendingOrderFilled` | `orderId`, `lender` |
| `LendingOrderCancelled` | `orderId` |
| `BorrowRequestCreated` | `requestId`, `borrower`, `amount`, `collateralToken` |
| `BorrowRequestCancelled` | `requestId` |

### Interactions

- **Called by**: LoanManager (fill orders/requests during loan creation)
- **Called by**: Users directly (create/cancel orders)

---

## LoanManager

Core loan lifecycle manager. Orchestrates loan creation, repayment, and liquidation across all protocol contracts.

| Property | Value |
|----------|-------|
| **Address** | [`0x356e137F8F93716e1d92F66F9e2d4866C586d9cf`](https://basescan.org/address/0x356e137F8F93716e1d92F66F9e2d4866C586d9cf) |
| **Inherits** | `INomoLend`, `ReentrancyGuard`, `Pausable`, `AccessControl` |
| **Source** | `contracts/LoanManager.sol` |

### Roles

| Role | Purpose |
|------|---------|
| `DEFAULT_ADMIN_ROLE` | Can grant/revoke all roles |
| `ADMIN_ROLE` | Set reserve fund, reserve fee, pause/unpause, toggle public liquidation |
| `LIQUIDATOR_ROLE` | Execute liquidations (bot wallet) |

### Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `REPAYMENT_GRACE_PERIOD` | 4 hours | Grace period after loan expiry for repayment |
| `MIN_LOAN_AMOUNT` | 10 USDC (10e6) | Minimum loan amount |
| `LIQUIDATION_BONUS_BPS` | 100 (1%) | Bonus for public liquidators |

### State Variables

| Variable | Type | Description |
|----------|------|-------------|
| `config` | `ProtocolConfig` (immutable) | Protocol configuration |
| `orderBook` | `OrderBook` (immutable) | Order book reference |
| `collateralManager` | `CollateralManager` (immutable) | Collateral custody |
| `riskEngine` | `RiskEngine` (immutable) | Risk assessment |
| `liquidationEngine` | `LiquidationEngine` (immutable) | Liquidation execution |
| `priceOracle` | `PriceOracle` (immutable) | Price feeds |
| `usdc` | `IERC20` (immutable) | USDC token |
| `reserveFund` | `address` | Reserve fund address |
| `reserveFeeBps` | `uint256` | Reserve fee (default 2000 = 20% of platform fee) |
| `publicLiquidationEnabled` | `bool` | Whether public liquidation is active |

### Functions

| Function | Access | Description |
|----------|--------|-------------|
| `takeLoan(uint256, uint256, address, uint256)` | Public | Borrow from a lending order (orderId, amount, collateralToken, collateralAmount) |
| `fillBorrowRequest(uint256, uint256)` | Public | Lend to a borrow request (requestId, USDC amount) |
| `repayLoan(uint256)` | Public (borrower only) | Repay a loan (principal + bracket interest) |
| `liquidateLoan(uint256, uint256)` | LIQUIDATOR or Public | Liquidate expired or undercollateralized loan |
| `setPublicLiquidation(bool)` | ADMIN_ROLE | Enable/disable public liquidation |
| `setReserveFund(address)` | ADMIN_ROLE | Set reserve fund address |
| `setReserveFeeBps(uint256)` | ADMIN_ROLE | Set reserve fee percentage (max 50%) |
| `pause()` / `unpause()` | ADMIN_ROLE | Emergency pause/unpause |
| `getLoan(uint256)` | View | Get loan details |
| `getBorrowerLoans(address)` | View | Get all loan IDs for a borrower |
| `getLenderLoans(address)` | View | Get all loan IDs for a lender |
| `getBorrowerLoansPaginated(address, uint256, uint256)` | View | Paginated borrower loans |
| `getLenderLoansPaginated(address, uint256, uint256)` | View | Paginated lender loans |
| `getTotalProtocolLoans()` | View | Total number of loans created |
| `getCurrentDebt(uint256)` | View | Get current principal + interest for an active loan |
| `getLoanHealthFactor(uint256)` | View | Get health factor for an active loan |
| `isLoanLiquidatable(uint256)` | View | Check if a loan is expired or undercollateralized |

### Events

| Event | Parameters |
|-------|------------|
| `LoanCreated` | `loanId`, `lender`, `borrower`, `principal`, `collateralToken` |
| `LoanRepaid` | `loanId`, `principal`, `interest`, `platformFee` |
| `LoanLiquidated` | `loanId`, `collateralSold`, `debtRecovered`, `returnedToBorrower` |
| `LiquidationExecuted` | `loanId`, `liquidator`, `bonus` |
| `PublicLiquidationToggled` | `enabled` |
| `ReserveFundUpdated` | `newFund` |
| `ReserveFeeBpsUpdated` | `newBps` |
| `ReserveDeposited` | `amount` |

### Interactions

- **Calls**: OrderBook, CollateralManager, RiskEngine, LiquidationEngine, ProtocolConfig, PriceOracle
- **Uses**: InterestCalculator library

---

## LiquidationEngine

Handles collateral-to-USDC swaps during liquidation with primary/fallback router pattern and proceed distribution.

| Property | Value |
|----------|-------|
| **Address** | [`0x6e892AEadda28E630bbe84e469fdA25f1B1B4820`](https://basescan.org/address/0x6e892AEadda28E630bbe84e469fdA25f1B1B4820) |
| **Inherits** | `ReentrancyGuard`, `AccessControl` |
| **Source** | `contracts/LiquidationEngine.sol` |

### Roles

| Role | Purpose |
|------|---------|
| `DEFAULT_ADMIN_ROLE` | Can grant/revoke all roles |
| `LIQUIDATOR_ROLE` | Execute collateral swaps and distributions |
| `ADMIN_ROLE` | Set routers and slippage |

### Key Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `maxSlippageBps` | 500 (5%) | Maximum swap slippage |

### Functions

| Function | Access | Description |
|----------|--------|-------------|
| `setPrimaryRouter(address)` | ADMIN_ROLE | Set primary DEX router |
| `setFallbackRouter(address)` | ADMIN_ROLE | Set fallback DEX router |
| `setMaxSlippage(uint256)` | ADMIN_ROLE | Set max slippage (0.01%-10%) |
| `liquidateCollateral(address, uint256, uint256)` | LIQUIDATOR_ROLE | Swap collateral to USDC via primary/fallback router |
| `distributeProceeds(address, address, address, uint256, uint256, uint256)` | LIQUIDATOR_ROLE | Distribute USDC: fee -> treasury, debt -> lender, surplus -> borrower |
| `payLiquidatorBonus(address, uint256)` | LIQUIDATOR_ROLE | Pay bonus to public liquidator |
| `rescueTokens(address, uint256, address)` | ADMIN_ROLE | Rescue stuck tokens (cannot rescue USDC) |

### Events

| Event | Parameters |
|-------|------------|
| `CollateralLiquidated` | `token`, `amountIn`, `amountOut`, `router` |
| `RouterUpdated` | `routerType`, `router` |
| `SlippageUpdated` | `newSlippageBps` |
| `InsufficientFeeProceeds` | `platformFee`, `available` |
| `TokensRescued` | `token`, `amount`, `to` |

### Interactions

- **Called by**: LoanManager (during liquidation)
- **Calls**: ISwapRouter adapters (UniswapV3, Aerodrome)

---

## ReserveFund

Protocol safety reserve that accumulates a portion of platform fees to cover bad debt from failed liquidations.

| Property | Value |
|----------|-------|
| **Address** | [`0xDD4a6B527598B31dBcC760B58811278ceF9A3A13`](https://basescan.org/address/0xDD4a6B527598B31dBcC760B58811278ceF9A3A13) |
| **Inherits** | `AccessControl` |
| **Source** | `contracts/ReserveFund.sol` |

### Roles

| Role | Purpose |
|------|---------|
| `DEFAULT_ADMIN_ROLE` | Can grant/revoke all roles |
| `GOVERNANCE_ROLE` | Cover bad debt (multisig only) |

### Functions

| Function | Access | Description |
|----------|--------|-------------|
| `coverBadDebt(uint256, address, string)` | GOVERNANCE_ROLE | Withdraw funds to cover bad debt |
| `getReserveBalance()` | View | Get current USDC balance of the reserve |

### Events

| Event | Parameters |
|-------|------------|
| `ReserveDeposited` | `amount`, `from` |
| `BadDebtCovered` | `amount`, `recipient` |
| `ReserveFundUsed` | `amount`, `reason` |

### Interactions

- **Receives USDC from**: LoanManager (on loan repayment, reserve portion of platform fee)
- **Governed by**: Gnosis Safe multisig

---

## RiskGuardian

Emergency risk controller with deliberately limited powers. Cannot access funds or increase risk parameters.

| Property | Value |
|----------|-------|
| **Address** | [`0xb9b90eE151D53327c1C42a268Eb974A08f1E07Ef`](https://basescan.org/address/0xb9b90eE151D53327c1C42a268Eb974A08f1E07Ef) |
| **Inherits** | `AccessControl` |
| **Source** | `contracts/RiskGuardian.sol` |

### Roles

| Role | Purpose |
|------|---------|
| `DEFAULT_ADMIN_ROLE` | Can grant/revoke all roles |
| `RISK_GUARDIAN_ROLE` | Execute emergency actions |

### Functions

| Function | Access | Description |
|----------|--------|-------------|
| `pauseTokenBorrowing(address, string)` | RISK_GUARDIAN_ROLE | Pause borrowing for a token with reason |
| `unpauseTokenBorrowing(address)` | RISK_GUARDIAN_ROLE | Unpause borrowing for a token |
| `reduceTokenLTV(address, uint256)` | RISK_GUARDIAN_ROLE | Reduce LTV (can only decrease, min 10%) |
| `disableToken(address)` | RISK_GUARDIAN_ROLE | Disable a token entirely |

### Events

| Event | Parameters |
|-------|------------|
| `GuardianActionExecuted` | `action`, `token`, `guardian` |

### Interactions

- **Calls**: RiskEngine (setTokenPaused, deactivateToken, setTokenRiskParams)

---

## UniswapV3Adapter

Wraps the Uniswap V3 SwapRouter02 to the protocol's `ISwapRouter` interface. Supports per-token fee tier configuration.

| Property | Value |
|----------|-------|
| **Address** | [`0x43215Df48f040CD5A76ed2a19b9e27E62308b1DC`](https://basescan.org/address/0x43215Df48f040CD5A76ed2a19b9e27E62308b1DC) |
| **Inherits** | `ISwapRouter` |
| **Source** | `contracts/adapters/UniswapV3Adapter.sol` |

### Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `DEFAULT_FEE` | 3000 | Default fee tier (0.3%) |

### Functions

| Function | Access | Description |
|----------|--------|-------------|
| `swap(address, address, uint256, uint256, address)` | Public | Execute swap via Uniswap V3 `exactInputSingle` |
| `setCustomFee(address, uint24)` | Owner | Set custom fee tier for a token |
| `transferOwnership(address)` | Owner | Start 2-step ownership transfer |
| `acceptOwnership()` | Pending Owner | Accept ownership transfer |
| `rescueTokens(address, uint256, address)` | Owner | Rescue stuck tokens |

### Interactions

- **Called by**: LiquidationEngine (as primary router)

---

## AerodromeAdapter

Wraps the Aerodrome AMM router for single-hop swaps through volatile or stable pools.

| Property | Value |
|----------|-------|
| **Address** | [`0x06578CB045e2c588f9b204416d5dbf5e689A2639`](https://basescan.org/address/0x06578CB045e2c588f9b204416d5dbf5e689A2639) |
| **Inherits** | `ISwapRouter` |
| **Source** | `contracts/adapters/AerodromeAdapter.sol` |

### Functions

| Function | Access | Description |
|----------|--------|-------------|
| `swap(address, address, uint256, uint256, address)` | Public | Execute swap via Aerodrome single-hop route |
| `setStablePool(address, bool)` | Owner | Configure stable/volatile pool preference per token |
| `transferOwnership(address)` | Owner | Start 2-step ownership transfer |
| `acceptOwnership()` | Pending Owner | Accept ownership transfer |
| `rescueTokens(address, uint256, address)` | Owner | Rescue stuck tokens |

### Interactions

- **Called by**: LiquidationEngine (as fallback router)

---

## AerodromeCLAdapter

Wraps the Aerodrome Slipstream (Concentrated Liquidity) router. Supports configurable tick spacing per token.

| Property | Value |
|----------|-------|
| **Address** | [`0x51e7a5E748fFd0889F14f5fAd605441900d0DA27`](https://basescan.org/address/0x51e7a5E748fFd0889F14f5fAd605441900d0DA27) |
| **Inherits** | `ISwapRouter` |
| **Source** | `contracts/adapters/AerodromeCLAdapter.sol` |

### Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `DEFAULT_TICK_SPACING` | 100 | Default CL100 tick spacing |

### Functions

| Function | Access | Description |
|----------|--------|-------------|
| `swap(address, address, uint256, uint256, address)` | Public | Execute swap via Aerodrome Slipstream CL `exactInputSingle` |
| `setCustomTickSpacing(address, int24)` | Owner | Set tick spacing for a token |
| `transferOwnership(address)` | Owner | Start 2-step ownership transfer |
| `acceptOwnership()` | Pending Owner | Accept ownership transfer |
| `rescueTokens(address, uint256, address)` | Owner | Rescue stuck tokens |

### Interactions

- **Called by**: LiquidationEngine (as alternative router)

---

## AerodromeMultihopAdapter

Wraps the Aerodrome router with multi-hop support for tokens without direct USDC liquidity. Routes through WETH as an intermediate token (TOKEN -> WETH -> USDC).

| Property | Value |
|----------|-------|
| **Address** | Not separately listed in deployments (deployed as part of the adapter set) |
| **Inherits** | `ISwapRouter` |
| **Source** | `contracts/adapters/AerodromeMultihopAdapter.sol` |

### Functions

| Function | Access | Description |
|----------|--------|-------------|
| `swap(address, address, uint256, uint256, address)` | Public | Execute single-hop or multi-hop swap based on configuration |
| `setStablePool(address, bool)` | Owner | Configure stable pool for single-hop |
| `setMultihopRoute(address, bool, bool, bool)` | Owner | Configure multi-hop route (enable, first leg stable, second leg stable) |
| `transferOwnership(address)` | Owner | Start 2-step ownership transfer |
| `acceptOwnership()` | Pending Owner | Accept ownership transfer |
| `rescueTokens(address, uint256, address)` | Owner | Rescue stuck tokens |

### Events

| Event | Parameters |
|-------|------------|
| `MultihopRouteSet` | `token`, `enabled`, `firstLegStable`, `secondLegStable` |
| `StablePoolSet` | `token`, `stable` |

### Interactions

- **Called by**: LiquidationEngine (as alternative router for illiquid tokens)

---

## InterestCalculator (Library)

Pure library for deterministic bracket-based interest calculation. Interest is charged based on which time bracket the loan reaches, not pro-rata.

| Property | Value |
|----------|-------|
| **Source** | `contracts/libraries/InterestCalculator.sol` |
| **Type** | Library (embedded in LoanManager) |

### Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `INTEREST_7D` | 200 bps | 2% interest rate |
| `INTEREST_14D` | 400 bps | 4% interest rate |
| `INTEREST_30D` | 800 bps | 8% interest rate |
| `SEVEN_DAYS` | 604,800 sec | 7-day duration |
| `FOURTEEN_DAYS` | 1,209,600 sec | 14-day duration |
| `THIRTY_DAYS` | 2,592,000 sec | 30-day duration |

### Functions

| Function | Description |
|----------|-------------|
| `getDurationSeconds(Duration)` | Convert Duration enum to seconds |
| `getMaxInterestBps(Duration)` | Get max interest rate for a duration |
| `calculateInterest(uint256, Duration, uint256)` | Calculate interest based on principal, duration, and elapsed time |

### Bracket Logic

For a 30-day loan:
- Repaid within 7 days: 2% interest
- Repaid within 8-14 days: 4% interest
- Repaid after 14 days: 8% interest

---

## Interfaces

### INomoLend

Core type definitions shared across all protocol contracts.

| Source | `contracts/interfaces/INomoLend.sol` |
|--------|--------------------------------------|

**Enums**: `OrderStatus` (OPEN, FILLED, CANCELLED), `LoanStatus` (ACTIVE, REPAID, LIQUIDATED), `Duration` (SEVEN_DAYS, FOURTEEN_DAYS, THIRTY_DAYS)

**Structs**: `LendingOrder`, `BorrowRequest`, `Loan`, `TokenRiskParams`

**Events**: `LendingOrderCreated`, `LendingOrderFilled`, `LendingOrderCancelled`, `BorrowRequestCreated`, `BorrowRequestCancelled`, `LoanCreated`, `LoanRepaid`, `LoanLiquidated`, `TokenPaused`, `TokenUnpaused`

### IPriceOracle

Price feed interface for the protocol.

| Source | `contracts/interfaces/IPriceOracle.sol` |
|--------|----------------------------------------|

| Function | Description |
|----------|-------------|
| `getPrice(address)` | Returns price (6 decimals) and confidence flag |
| `getValueInUsdc(address, uint256)` | Returns USDC value of a token amount |

### ISwapRouter

Unified DEX swap interface implemented by all adapters.

| Source | `contracts/interfaces/ISwapRouter.sol` |
|--------|---------------------------------------|

| Function | Description |
|----------|-------------|
| `swap(address, address, uint256, uint256, address)` | Execute swap from tokenIn to tokenOut with slippage protection |

### ITokenValidator

Token security validation interface.

| Source | `contracts/interfaces/ITokenValidator.sol` |
|--------|--------------------------------------------|

| Function | Description |
|----------|-------------|
| `validateToken(address)` | Returns (valid, reason) for a token |

---

## Further Reading

- [Protocol Overview](./overview.md) -- What NomoLend is, interest rates, collateral tokens
- [Architecture](./architecture.md) -- System design, contract relationships, and data flow diagrams
