# NomoLend Known Risks and Mitigations

## Overview

This document catalogues the known risk vectors for the NomoLend protocol and the mitigations implemented for each. Users should review this document alongside the on-chain risk parameters before interacting with the protocol.

---

## 1. DEX Liquidity Risk

**Risk:** Insufficient DEX liquidity for a collateral token could prevent liquidations from executing, leaving the protocol with undercollateralized loans.

**Mitigations:**
- **Liquidity checks** — The LiquidationEngine verifies available DEX liquidity before executing swaps
- **Loan-to-liquidity ratio** — Maximum 15% of available DEX liquidity can be used per liquidation
- **Multiple DEX adapters** — Three swap adapters deployed (UniswapV3, Aerodrome V2, Aerodrome CL) for routing fallback
- **Exposure limits** — Per-token maximum exposure caps prevent excessive concentration in illiquid tokens
- **Tier system** — Lower-liquidity tokens are assigned to higher-risk tiers (C/D) with lower LTV ratios, requiring more overcollateralization

---

## 2. Oracle Dependency

**Risk:** Incorrect or stale price data could lead to improper loan valuations, allowing undercollateralized borrowing or triggering unwarranted liquidations.

**Mitigations:**
- **Dual oracle system** — Tier A/B tokens use Chainlink price feeds as primary source with TWAP as fallback
- **Deviation check** — Prices are cross-validated between Chainlink and TWAP; large deviations trigger alerts
- **Staleness protection** — Oracle prices older than 30 minutes are flagged as stale
- **Confidence flag** — The `getPrice()` function returns a `confidence` boolean; low-confidence prices restrict new loan creation
- **Keeper monitoring** — Price Updater bot refreshes TWAP prices every 5 minutes across all 21 tokens
- **Admin alerts** — Stale prices generate Telegram notifications for immediate operator response

---

## 3. Market Volatility

**Risk:** Rapid price drops could cause collateral value to fall below the loan value before liquidation can execute, creating bad debt.

**Mitigations:**
- **Circuit breaker** — The RiskGuardian contract can pause protocol operations during extreme market events
- **Dynamic LTV per tier** — Higher-volatility tokens require significantly more overcollateralization:
  - Tier A (stable/ETH): 40% LTV (2.5x overcollateralization)
  - Tier B (mid-cap): 35% LTV (2.86x overcollateralization)
  - Tier C (emerging): 30% LTV (3.33x overcollateralization)
  - Tier D (small-cap): 25% LTV (4x overcollateralization)
- **Liquidation threshold gap** — The gap between LTV and liquidation threshold provides a buffer zone (e.g., Tier A: 40% LTV vs 60% liquidation = 20% buffer)
- **Health factor monitoring** — Continuous scanning at 1-minute intervals with escalating alerts at HF < 1.2

---

## 4. Smart Contract Risk

**Risk:** Bugs or vulnerabilities in the smart contracts could lead to loss of funds.

**Mitigations:**
- **Reentrancy guards** — All state-changing functions use OpenZeppelin ReentrancyGuard
- **Pausable contracts** — All core contracts inherit OpenZeppelin Pausable; can be paused by governance
- **Access control** — Role-based access control (OpenZeppelin AccessControl) on all privileged functions
- **Repayment during pause** — Loan repayments remain functional even when the protocol is paused, preventing collateral lockup
- **15/15 test coverage** — Unit tests, integration tests, and edge cases covering interest calculation, order book, fees, risk limits, collateral, borrow flows, emergency pause, and oracle accuracy
- **Modular architecture** — Separation of concerns across 8+ contracts limits blast radius of any single vulnerability

---

## 5. RPC Dependency

**Risk:** RPC provider downtime could prevent keeper bots from monitoring prices, scanning loans, or executing liquidations.

**Mitigations:**
- **Multi-RPC failover** — Three RPC endpoints configured with automatic failover:
  1. Primary RPC endpoint
  2. Secondary RPC endpoint
  3. Alchemy (tertiary fallback)
- **Vercel Cron backup** — Cron jobs on Vercel infrastructure provide a secondary execution path for price updates and loan scanning, independent of the PM2 bot infrastructure
- **Dual execution** — Both PM2 bots and Vercel Crons perform the same monitoring tasks, providing redundancy

---

## 6. Keeper Failure

**Risk:** If keeper bots go offline, prices become stale and liquidations may not execute, leading to accumulating bad debt.

**Mitigations:**
- **PM2 process management** — Auto-restart on crash with PM2
- **Watchdog monitoring** — Monitor bot checks health of other bots every 2 minutes
- **Health alerts** — Telegram/Discord notifications on bot failure or stale prices
- **Admin bot panel** — Real-time bot status visible at `/admin/bots` with manual refresh
- **Vercel Cron redundancy** — Even if PM2 bots fail, Vercel Crons continue price updates (every 5 min) and loan scanning (every 2 min)
- **Manual toggle** — Admin can disable/re-enable individual bots from the control panel

---

## 7. Bad Debt

**Risk:** If a liquidation does not fully cover the outstanding loan (e.g., due to slippage, price gap, or insufficient liquidity), the protocol absorbs the loss.

**Mitigations:**
- **ReserveFund** — 20% of all platform fees are directed to the ReserveFund contract (`0xDD4a6B527598B31dBcC760B58811278ceF9A3A13`), creating a growing buffer specifically for bad debt coverage
- **Conservative LTV ratios** — Even the most generous tier (A) requires 2.5x overcollateralization, providing substantial buffer before bad debt occurs
- **Slippage tolerance** — Liquidation bot uses 5% slippage tolerance to ensure swaps execute even in volatile conditions
- **Exposure caps** — Per-token exposure limits prevent any single token from creating systemic bad debt risk
- **Reserve-only usage** — The ReserveFund can only be accessed by governance (Safe multisig) and is explicitly reserved for bad debt situations

---

## 8. Governance Risk

**Risk:** A compromised governance key could modify protocol parameters maliciously (e.g., draining funds, disabling protections).

**Mitigations:**
- **Gnosis Safe 2-of-3 multisig** — All admin operations require 2 out of 3 signers to approve
  - Safe address: `0x362D5267A61f65cb4901B163B5D94adbf147DB87`
- **Deployer revoked** — The deployer wallet (`0x9ce3F036365DfAf608D5F98B34A5872bbe5Ee125`) has been stripped of all on-chain roles via `renounceRole()` across all 10 protocol contracts
- **Role separation** — Bot wallet only holds `PRICE_UPDATER_ROLE` and `LIQUIDATOR_ROLE`; it cannot modify protocol parameters, whitelist tokens, or change risk settings
- **Post-migration verification** — Automated verification confirms deployer has zero protocol powers after migration
- **On-chain transparency** — All role assignments are verifiable on-chain via `hasRole()` calls; the admin panel displays a live security audit table

---

## Risk Matrix

```
+-----------------------+----------+-----------+---------------------------+
| Risk                  | Severity | Likelihood| Primary Mitigation        |
+-----------------------+----------+-----------+---------------------------+
| DEX Liquidity         | High     | Medium    | 15% loan-to-liquidity cap |
| Oracle Dependency     | High     | Low       | Dual oracle + staleness   |
| Market Volatility     | High     | High      | 4-tier LTV + circuit break|
| Smart Contract Bug    | Critical | Low       | Tests + guards + pausable |
| RPC Downtime          | Medium   | Medium    | 3-endpoint failover       |
| Keeper Failure        | Medium   | Low       | PM2 + Cron + watchdog     |
| Bad Debt              | High     | Low       | ReserveFund + LTV buffers |
| Governance Compromise | Critical | Very Low  | 2-of-3 multisig          |
+-----------------------+----------+-----------+---------------------------+
```
