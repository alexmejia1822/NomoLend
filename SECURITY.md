# Security Model

NomoLend implements defense-in-depth security across smart contracts, keeper bots, and protocol governance.

## Access Control

All contracts use OpenZeppelin's `AccessControl` with the following role hierarchy:

```
DEFAULT_ADMIN_ROLE (0x00)
  |
  +-- ADMIN_ROLE
  |     Protocol configuration, pause/unpause, contract registry
  |
  +-- RISK_MANAGER_ROLE
  |     Token risk parameters, whitelist/blacklist, exposure limits
  |
  +-- LIQUIDATOR_ROLE
  |     Execute liquidations, swap collateral on DEX
  |
  +-- PRICE_UPDATER_ROLE
  |     Update TWAP prices on PriceOracle
  |
  +-- LOAN_MANAGER_ROLE
  |     Fill orders on OrderBook, manage collateral (contract-to-contract only)
  |
  +-- RISK_GUARDIAN_ROLE
  |     Emergency: pause tokens, reduce LTV (never increase), disable tokens
  |
  +-- GOVERNANCE_ROLE
        Use reserve fund to cover bad debt
```

### Active Governance (Live)

| Role | Wallet | Purpose |
|------|--------|---------|
| All admin roles (21 total) | 2-of-3 Gnosis Safe `0x362D...DB87` | Protocol governance |
| PRICE_UPDATER + LIQUIDATOR | Bot wallet `0x78cB...5E03` | Automated operations |
| Deployer `0x9ce3...3A25` | **Zero roles** (all revoked) | Retired |

The deployer wallet has been fully decommissioned. All `DEFAULT_ADMIN_ROLE`, `ADMIN_ROLE`, `RISK_MANAGER_ROLE`, `GOVERNANCE_ROLE`, `RISK_GUARDIAN_ROLE`, `PRICE_UPDATER_ROLE`, and `LIQUIDATOR_ROLE` permissions were transferred to the Gnosis Safe and then renounced by the deployer.

The bot wallet operates with **minimum privilege** — it can only update prices and execute liquidations. It cannot modify protocol parameters, pause contracts, or access funds.

## Smart Contract Security

### Reentrancy Protection

All functions that handle token transfers use OpenZeppelin's `ReentrancyGuard`:
- `LoanManager`: takeLoan, fillBorrowRequest, repayLoan, liquidateLoan
- `OrderBook`: createLendingOrder, cancelLendingOrder, createBorrowRequest, cancelBorrowRequest
- `CollateralManager`: depositCollateral, releaseCollateral, releaseForLiquidation
- `LiquidationEngine`: liquidateCollateral, distributeProceeds

### Fee-on-Transfer Token Rejection

`CollateralManager` verifies that the actual amount received matches the amount specified:

```solidity
uint256 balanceBefore = IERC20(token).balanceOf(address(this));
IERC20(token).safeTransferFrom(from, address(this), amount);
uint256 received = IERC20(token).balanceOf(address(this)) - balanceBefore;
require(received == amount, "Fee-on-transfer tokens not supported");
```

### DEX Approval Hygiene

The `LiquidationEngine` resets token approvals to zero after every swap (both successful and failed), preventing lingering approvals that could be exploited.

### Pausable Contracts

`LoanManager` and `OrderBook` implement OpenZeppelin's `Pausable`. When paused:
- No new loans can be created
- No new orders can be placed
- **Repayments still work** (borrowers can always repay)
- **Liquidations still work** (protocol solvency is maintained)

## Oracle Security

### Dual Oracle System

Prices are sourced from two independent systems:
- **Primary**: Chainlink price feeds (WETH, cbETH, DAI, USDbC, LINK)
- **Fallback**: TWAP data updated by keeper bot via CoinGecko (all tokens)

### TWAP Manipulation Protection

Three layers prevent price manipulation:

| Protection | Description |
|-----------|-------------|
| **Cooldown** | Minimum 5 minutes between updates per token |
| **Max change** | Each update limited to 10% price change |
| **Staleness** | Prices older than 25 hours are rejected |

A 25% price drop requires at least 3 update cycles (15+ minutes), preventing flash attacks.

### Deviation Check

When both Chainlink and TWAP are available, a >5% deviation between them sets `confidence = false`, which blocks new loans for that token until prices converge.

## Risk Controls

### Circuit Breaker

If a token's price drops 30%+ from its last snapshot, the token is automatically paused:
- No new loans can use this token as collateral
- Existing loans can still be liquidated
- Must be manually unpaused by RISK_MANAGER_ROLE or RISK_GUARDIAN_ROLE

### Borrowing Surge Detection

If >50,000 USDC is borrowed against a single token within a 1-hour window, the token is automatically paused. Uses a sliding window with carry-over to catch bursts across window boundaries.

### Exposure Limits

Each token has a maximum protocol-wide USDC exposure (default: 100,000 USDC). Prevents concentration risk in any single token.

### DOS Protection

| Mechanism | Limit | Range |
|-----------|-------|-------|
| Max active orders per user | 20 | 1-100 |
| Max loans per user per token | 5 | 1-50 |
| Minimum loan amount | 10 USDC | Fixed |

## Router Timelock

Changing DEX routers requires a **24-hour timelock**:

1. Admin calls `proposePrimaryRouter(newRouter)` -- pending for 24h
2. After 24 hours, admin calls `executePrimaryRouter()`
3. Admin can cancel a pending change at any time

This prevents instant router swaps that could redirect liquidation swaps to a malicious contract.

## Token Rescue

- **CollateralManager**: Can only rescue tokens in excess of tracked locked collateral
- **LiquidationEngine**: Can rescue any token except USDC (prevents draining proceeds)

## RiskGuardian (Emergency Contract)

The `RiskGuardian` contract has intentionally limited powers for a separate emergency multisig:
- Can pause/unpause token borrowing
- Can reduce LTV (never increase, minimum 10% floor)
- Can disable tokens entirely
- **Cannot** access funds or modify critical parameters

## Token Whitelist

Tokens must pass the following checks before being accepted as collateral:
1. Off-chain security review (no malicious functions, proper ERC20 implementation)
2. Whitelisted via `TokenValidator`
3. Valid decimals (6-18)
4. Non-zero total supply
5. Not blacklisted

## Reporting Vulnerabilities

If you discover a security vulnerability, please report it responsibly by emailing the team directly. Do not open a public issue.

## Security Review Status

NomoLend has undergone a comprehensive internal security review. All identified findings have been resolved and are documented in `docs/security.md`. An external audit is planned for a future milestone. The `audit-package/` directory contains materials prepared for external auditors.
