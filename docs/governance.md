# NomoLend Governance

Protocol governance model based on a 2-of-3 Gnosis Safe multisig on Base. All admin privileges have been transferred from the deployer wallet to the multisig, and the deployer has been fully decommissioned.

---

## Gnosis Safe Multisig

| Property | Value |
|----------|-------|
| Address | `0x362D5267A61f65cb4901B163B5D94adbf147DB87` |
| Network | Base (Chain ID: 8453) |
| Type | Gnosis Safe |
| Threshold | 2-of-3 |
| UI | [app.safe.global](https://app.safe.global) |
| Transaction Service | `https://safe-transaction-base.safe.global` |

All protocol parameter changes, role grants, token whitelisting, pausing, and administrative actions require 2 out of 3 Safe owners to sign.

---

## Migration from Deployer

The migration was executed in 4 phases using `scripts/migrate-to-multisig.js`:

```
Phase 1: Role Audit
   |
   +-- Read all roles across 10 contracts
   +-- Verify deployer/safe/bot state for each role
   |
Phase 2: Grant Bot Roles
   |
   +-- PriceOracle.grantRole(PRICE_UPDATER_ROLE, botWallet)
   +-- LoanManager.grantRole(LIQUIDATOR_ROLE, botWallet)
   |
Phase 3: Grant Safe + Revoke Deployer
   |
   +-- For each contract, for each admin role:
   |     1. grantRole(role, safeAddress)
   |     2. Verify safe has role
   |     3. renounceRole(role, deployer)
   |
Phase 4: Post-Migration Verification
   |
   +-- Confirm deployer has ZERO roles across all contracts
```

### Migration Scripts

| Script | Purpose |
|--------|---------|
| `scripts/migrate-to-multisig.js` | Full migration: audit, grant bot roles, grant safe, revoke deployer |
| `scripts/safe-grant-roles.js` | Grant remaining roles (RISK_MANAGER, RISK_GUARDIAN) via Safe TX Service |
| `scripts/cleanup-deployer.js` | Renounce any remaining deployer roles (final cleanup) |

### Post-Migration State

| Wallet | Status | Roles |
|--------|--------|-------|
| Deployer `0x9ce3...3A25` | Decommissioned | Zero roles across all contracts |
| Safe `0x362D...DB87` | Active governor | All admin roles (21 instances) |
| Bot `0x78cB...5E03` | Active keeper | PRICE_UPDATER + LIQUIDATOR only |

---

## Role-Permission Matrix

Complete matrix showing which roles can perform which actions:

### Protocol Configuration

| Action | Required Role | Contract |
|--------|--------------|----------|
| Set protocol parameters | ADMIN_ROLE | ProtocolConfig |
| Propose primary router | ADMIN_ROLE | ProtocolConfig |
| Execute primary router (after 24h) | ADMIN_ROLE | ProtocolConfig |
| Propose fallback router | ADMIN_ROLE | ProtocolConfig |
| Execute fallback router (after 24h) | ADMIN_ROLE | ProtocolConfig |
| Cancel pending router change | ADMIN_ROLE | ProtocolConfig |
| Pause/unpause protocol | ADMIN_ROLE | LoanManager |

### Token Management

| Action | Required Role | Contract |
|--------|--------------|----------|
| Whitelist token | RISK_MANAGER_ROLE | TokenValidator |
| Blacklist token | RISK_MANAGER_ROLE | TokenValidator |
| Set token risk parameters (LTV, liquidation threshold, max exposure) | RISK_MANAGER_ROLE | RiskEngine |
| Pause token borrowing | RISK_MANAGER_ROLE or RISK_GUARDIAN_ROLE | RiskEngine |
| Deactivate token | RISK_MANAGER_ROLE | RiskEngine |

### Oracle Management

| Action | Required Role | Contract |
|--------|--------------|----------|
| Add/configure price feed | ADMIN_ROLE | PriceOracle |
| Update TWAP prices | PRICE_UPDATER_ROLE | PriceOracle |
| Deactivate price feed | ADMIN_ROLE | PriceOracle |

### Liquidation & Funds

| Action | Required Role | Contract |
|--------|--------------|----------|
| Execute liquidation | LIQUIDATOR_ROLE | LoanManager |
| Set router/adapter | ADMIN_ROLE | LiquidationEngine |
| Use reserve fund for bad debt | GOVERNANCE_ROLE | ReserveFund |
| Rescue stuck tokens | DEFAULT_ADMIN_ROLE | CollateralManager, LiquidationEngine |

### Emergency Actions (RiskGuardian)

| Action | Required Role | Constraint |
|--------|--------------|------------|
| Pause token borrowing | RISK_GUARDIAN_ROLE | — |
| Unpause token borrowing | RISK_GUARDIAN_ROLE | — |
| Reduce token LTV | RISK_GUARDIAN_ROLE | Can only decrease, minimum 10% floor |
| Disable token entirely | RISK_GUARDIAN_ROLE | Permanent until re-activated by RISK_MANAGER |

### Role Administration

| Action | Required Role | Contract |
|--------|--------------|----------|
| Grant any role | DEFAULT_ADMIN_ROLE | Any contract |
| Revoke any role | DEFAULT_ADMIN_ROLE | Any contract |
| Renounce own role | Self | Any contract |

---

## Router Timelock

DEX router changes are protected by a mandatory 24-hour waiting period:

```
    Admin proposes              24h pass               Admin executes
         |                         |                        |
    T=0  +--- proposePrimaryRouter(newRouter) ---+          |
         |                                       |          |
         |            Pending state               |          |
         |            (visible on-chain)          |          |
         |                                       |          |
    T=24h+-------- executePrimaryRouter() -------+----------+
         |                                                  |
         |           cancelPrimaryRouter()                  |
         +--- (available at any time during wait) ----------+
```

| Parameter | Value |
|-----------|-------|
| Timelock duration | 24 hours (`ROUTER_TIMELOCK`) |
| Cancellation | Available at any time by ADMIN_ROLE |
| Scope | Both primary and fallback routers |

This prevents instant swaps to a malicious router contract that could steal liquidation proceeds.

---

## RiskGuardian

A separate contract with deliberately restricted powers, designed for faster emergency response without full multisig coordination.

### Design Philosophy

The RiskGuardian can only **reduce** risk exposure, never increase it:

- Can pause tokens (stops new loans against that collateral)
- Can reduce LTV (requires less collateral per dollar borrowed)
- Can disable tokens (permanent removal from active collateral)
- Cannot increase LTV, access funds, or change protocol parameters

### LTV Floor (M-5-03)

The `reduceTokenLTV` function enforces a minimum LTV of 10% (1,000 BPS):

```
require(newLtvBps >= 1000, "Min LTV is 10%")
require(newLtvBps < currentLtv, "Can only reduce LTV")
```

This prevents accidental lockout where setting LTV to 0 would make all existing loans immediately liquidatable.

---

## Parameter Change Process

### Standard Parameter Change

```
1. Owner proposes change in Safe UI (app.safe.global)
2. First signer signs the transaction
3. Second signer reviews and co-signs (threshold: 2/3)
4. Transaction executes on-chain
```

### Router Change

```
1. Safe proposes new router via proposePrimaryRouter()
2. 24-hour timelock begins
3. Community/team reviews the proposed router contract
4. After 24 hours, Safe executes via executePrimaryRouter()
5. If issues found, Safe cancels via cancelPrimaryRouter()
```

### Emergency Token Pause

```
Option A (Fast): RiskGuardian
   1. Single RISK_GUARDIAN_ROLE holder calls pauseTokenBorrowing()
   2. Immediate effect

Option B (Standard): Safe multisig
   1. Safe proposes setTokenPaused() on RiskEngine
   2. 2-of-3 signatures required
   3. Execute transaction
```

---

## Contract Registry

All contracts governed by the multisig:

| Contract | Address | Admin Roles Held by Safe |
|----------|---------|--------------------------|
| ProtocolConfig | Deployed on Base | DEFAULT_ADMIN, ADMIN, RISK_MANAGER |
| TokenValidator | Deployed on Base | DEFAULT_ADMIN, RISK_MANAGER |
| PriceOracle | Deployed on Base | DEFAULT_ADMIN, ADMIN |
| RiskEngine | Deployed on Base | DEFAULT_ADMIN, RISK_MANAGER |
| CollateralManager | Deployed on Base | DEFAULT_ADMIN |
| LiquidationEngine | Deployed on Base | DEFAULT_ADMIN, ADMIN |
| OrderBook | Deployed on Base | DEFAULT_ADMIN |
| LoanManager | Deployed on Base | DEFAULT_ADMIN, ADMIN |
| ReserveFund | Deployed on Base | DEFAULT_ADMIN, GOVERNANCE |
| RiskGuardian | Deployed on Base | DEFAULT_ADMIN, RISK_GUARDIAN |
