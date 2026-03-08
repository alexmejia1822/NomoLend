# NomoLend Security Model

Defense-in-depth security across smart contracts, oracle infrastructure, keeper bots, and protocol governance on Base.

> **Security Review Status:** NomoLend has undergone a comprehensive internal security review. All findings (H-01 through L-3-05) were identified and resolved during this process. An external audit is planned for a future milestone.

---

## Access Control

All contracts use OpenZeppelin's `AccessControl` with a role-based permission hierarchy.

### Role Hierarchy

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

### Active Role Assignments

| Wallet | Roles | Purpose |
|--------|-------|---------|
| Gnosis Safe `0x362D...DB87` | All 21 admin role instances across 10 contracts | Protocol governance (2-of-3 multisig) |
| Bot wallet `0x78cB...5E03` | `PRICE_UPDATER_ROLE` (PriceOracle), `LIQUIDATOR_ROLE` (LoanManager) | Automated keeper operations |
| Deployer `0x9ce3...3A25` | **Zero roles** (all revoked) | Fully decommissioned |

### Role Distribution by Contract

| Contract | DEFAULT_ADMIN | ADMIN | RISK_MANAGER | LIQUIDATOR | PRICE_UPDATER | GOVERNANCE | RISK_GUARDIAN |
|----------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| ProtocolConfig | Safe | Safe | Safe | | | | |
| TokenValidator | Safe | | Safe | | | | |
| PriceOracle | Safe | Safe | | | Safe, Bot | | |
| RiskEngine | Safe | | Safe | | | | |
| CollateralManager | Safe | | | | | | |
| LiquidationEngine | Safe | Safe | | | | | |
| OrderBook | Safe | | | | | | |
| LoanManager | Safe | Safe | | Bot | | | |
| ReserveFund | Safe | | | | | Safe | |
| RiskGuardian | Safe | | | | | | Safe |

### Minimum Privilege Principle

The bot wallet holds exactly 2 roles:

- **PRICE_UPDATER_ROLE** on PriceOracle — can update TWAP prices
- **LIQUIDATOR_ROLE** on LoanManager — can execute liquidations

It **cannot**: modify protocol parameters, pause/unpause contracts, change routers, access funds, whitelist tokens, or grant/revoke roles.

---

## Smart Contract Protections

### ReentrancyGuard

All functions that handle token transfers use OpenZeppelin's `ReentrancyGuard`:

| Contract | Protected Functions |
|----------|-------------------|
| LoanManager | `takeLoan`, `fillBorrowRequest`, `repayLoan`, `liquidateLoan` |
| OrderBook | `createLendingOrder`, `cancelLendingOrder`, `createBorrowRequest`, `cancelBorrowRequest` |
| CollateralManager | `depositCollateral`, `releaseCollateral`, `releaseForLiquidation` |
| LiquidationEngine | `liquidateCollateral`, `distributeProceeds` |

### Fee-on-Transfer Token Rejection

`CollateralManager` verifies actual received amount matches the specified amount:

```
balanceBefore = token.balanceOf(this)
token.safeTransferFrom(from, this, amount)
received = token.balanceOf(this) - balanceBefore
require(received == amount)
```

Any token that deducts fees on transfer is rejected, preventing accounting discrepancies.

### DEX Approval Hygiene

The `LiquidationEngine` resets token approvals to zero after every swap, both on success and failure paths. This prevents lingering unlimited approvals from being exploited by a compromised or malicious router.

### Pausable Contracts

`LoanManager` and `OrderBook` implement OpenZeppelin's `Pausable`:

| State | Allowed | Blocked |
|-------|---------|---------|
| Paused | Repayments, Liquidations | New loans, New orders |
| Unpaused | All operations | — |

Repayments and liquidations remain operational during pause to protect both borrowers and protocol solvency.

---

## Oracle Security

### Dual Oracle System

| Source | Coverage | Update Method |
|--------|----------|---------------|
| Chainlink | WETH, cbETH, DAI, USDbC, LINK | Decentralized feeds |
| TWAP (keeper) | All 21+ tokens | Bot via CoinGecko + Aerodrome DEX pools |

### TWAP Manipulation Protection

Three layers prevent on-chain price manipulation:

| Protection | Parameter | Effect |
|-----------|-----------|--------|
| Cooldown | 5 min between updates per token | Limits update frequency |
| Max change | 10% per update (`maxTwapChangeBps`) | Caps single-update price swing |
| Staleness | 25 hour maximum age | Rejects outdated prices |

**Impact:** A 25% price drop requires at least 3 sequential update cycles (minimum 15 minutes), making flash manipulation impractical.

### Deviation Check

When both Chainlink and TWAP prices are available, a deviation >5% between them sets `confidence = false`. This blocks new loans for the affected token until prices converge, preventing exploitation of one corrupted price source.

---

## Risk Controls

### Circuit Breaker

A 30%+ price drop from the last snapshot automatically pauses the token:

- No new loans can use the token as collateral
- Existing loans can still be liquidated
- Requires manual unpause by `RISK_MANAGER_ROLE` or `RISK_GUARDIAN_ROLE`

### Borrowing Surge Detection

| Parameter | Value |
|-----------|-------|
| Volume threshold | 50,000 USDC per token |
| Time window | 1 hour (sliding) |
| Action | Auto-pause token |

Uses a sliding window with carry-over to detect bursts across window boundaries (M-01 fix: surge detection window halves to catch edge cases).

### Exposure Limits

Each token has a maximum protocol-wide USDC exposure (default: 100,000 USDC). Prevents concentration risk in any single collateral type.

### DOS Protection

| Mechanism | Limit | Configurable Range |
|-----------|-------|--------------------|
| Max active orders per user | 20 | 1 - 100 |
| Max loans per user per token | 5 | 1 - 50 |
| Minimum loan amount | 10 USDC | Fixed (H-04 fix) |

---

## Router Timelock

Changing DEX routers requires a 24-hour timelock on `ProtocolConfig`:

```
 T=0                    T=24h
  |                       |
  +-- proposePrimaryRouter(new) --> PENDING
  |                       |
  |   (24 hour waiting period)
  |                       |
  +-- executePrimaryRouter() -----> ACTIVE
  |                       |
  +-- cancelPrimaryRouter() ------> CANCELLED (at any time)
```

Both primary and fallback routers follow this timelock. This prevents instant router swaps that could redirect liquidation proceeds to a malicious contract.

---

## Token Rescue

| Contract | Rescue Constraint |
|----------|-------------------|
| CollateralManager | Can only rescue tokens **in excess** of tracked locked collateral (L-3-05) |
| LiquidationEngine | Can rescue any token **except USDC** (H-05: prevents draining liquidation proceeds) |
| All adapters | Owner can rescue accidentally stuck tokens |

---

## RiskGuardian (Emergency Contract)

A separate contract (`RiskGuardian.sol`) with intentionally limited powers for emergency response:

| Action | Allowed | Constraint |
|--------|---------|------------|
| Pause token borrowing | Yes | — |
| Unpause token borrowing | Yes | — |
| Reduce LTV | Yes | Can only decrease, never increase |
| LTV floor | Enforced | Minimum 10% (M-5-03: prevents accidental lockout) |
| Disable token entirely | Yes | Calls `deactivateToken()` |
| Access funds | **No** | — |
| Modify critical parameters | **No** | — |
| Grant/revoke roles | **No** | — |

---

## Token Whitelist

Tokens must pass all validation before acceptance as collateral:

1. Off-chain security review (no malicious functions, proper ERC20 implementation)
2. Whitelisted via `TokenValidator` contract
3. Valid decimals (6-18 inclusive)
4. Non-zero total supply
5. Not blacklisted

---

## Internal Security Review Findings

### High Severity

| ID | Fix | Description |
|----|-----|-------------|
| H-01 | Grace period 4 hours | Prevents immediate liquidation after price update |
| H-04 | Minimum 10 USDC | Prevents dust loans that could be used for griefing |
| H-05 | USDC not rescuable from LiquidationEngine | Protects liquidation proceeds from being drained |

### Medium Severity

| ID | Fix | Description |
|----|-----|-------------|
| M-01 | Surge detection window halves | Catches borrowing bursts across window boundaries |
| M-5-01 | Ghost read prevention | Prevents reading stale/deleted data from storage |
| M-5-02 | Graceful feed deactivation | Deactivating a price feed does not brick dependent loans |
| M-5-03 | LTV floor 10% in RiskGuardian | Prevents accidental lockout from setting LTV to 0 |
| M-5-04 | DEX liquidity staleness | On-chain liquidity checks include freshness validation |
| M-5-05 | Insufficient proceeds event | Emits event when liquidation proceeds do not cover debt |

### Low Severity

| ID | Fix | Description |
|----|-----|-------------|
| L-3-01 | Reset approval to zero | Approvals reset after every swap (success and failure) |
| L-3-05 | Rescue cannot touch locked collateral | `rescueTokens` only accesses excess balance |

---

## Vulnerability Reporting

If you discover a security vulnerability, report it responsibly by emailing the team directly. Do not open a public issue.
