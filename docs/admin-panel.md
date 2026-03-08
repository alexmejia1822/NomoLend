# NomoLend Admin Panel Documentation

## Overview

The NomoLend Admin Panel consists of two protected pages that provide protocol governance, token onboarding, bot management, and security monitoring capabilities. Access is restricted to authorized wallets only.

---

## Access Control

| Wallet | Address | Role |
|--------|---------|------|
| Safe Multisig | `0x362D5267A61f65cb4901B163B5D94adbf147DB87` | Primary governance (2-of-3) |
| Deployer | `0x9ce3F036365DfAf608D5F98B34A5872bbe5Ee125` | Legacy access (roles revoked on-chain) |

Unauthorized wallets see a "Acceso Denegado" (Access Denied) screen. The check is performed client-side by comparing the connected wallet address.

---

## Admin Page (`/admin`)

### Protocol Statistics

Real-time stats fetched on-chain with 15-second refresh intervals:

```
+---------------------+------------------+-------------------+------------------+
| Total Fees          | Treasury (80%)   | Reserve Fund (20%)| Protocol TVL     |
| Generated           | Withdrawable     | Bad debt only     | Offers + Loans   |
| 10% of interest     | by admin         |                   |                  |
+---------------------+------------------+-------------------+------------------+
```

Additional stat cards:
- **Ofertas (OrderBook)** — USDC available in the OrderBook for lending
- **Prestamos Activos** — USDC currently deployed in active loans
- **Prestamos Creados** — Historical total loan count

**Fee model breakdown:**
- Borrower pays interest to the protocol
- 90% of interest goes to the lender
- 10% is the platform fee, split as:
  - 80% to Treasury (protocol revenue)
  - 20% to Reserve Fund (bad debt coverage)

### Token Onboarding Wizard

A 4-step guided wizard for adding new collateral tokens:

```
Step 0: Enter Token Address
    |
    |  Auto-fetches: symbol, decimals, whitelist status,
    |  risk config status, current on-chain price
    v
Step 1: Whitelist Token
    |  Calls TokenValidator.whitelistToken(address)
    v
Step 2: Configure Price (TWAP)
    |  Calls PriceOracle.setPriceFeed(address, 0x0, decimals)
    |  Then PriceOracle.updateTwapPrice(address, priceInUsdc)
    v
Step 3: Configure Risk Parameters
    |  Select tier (A/B/C/D), set max exposure
    |  Calls RiskEngine.setTokenRiskParams(address, ltvBps, liqBps, maxExposure)
    v
Complete: Token ready for use as collateral
```

Each step tracks its transaction and auto-advances upon confirmation.

### Risk Tier Reference Table

| Tier | Market Cap | LTV | Liquidation | Collateral per $1,000 loan |
|------|-----------|-----|-------------|---------------------------|
| **Tier A** | >$150M | 40% | 60% | $2,500 |
| **Tier B** | >$100M | 35% | 55% | $2,857 |
| **Tier C** | >$50M | 30% | 50% | $3,333 |
| **Tier D** | >$20M | 25% | 50% | $4,000 |

### Loan Example Calculator

When a TWAP price is entered, a dynamic calculator shows:

- Required collateral value and token count for a $1,000 loan
- Liquidation trigger price and percentage drop
- Max simultaneous loans at the given exposure limit
- Max TVL in collateral value
- Tier comparison chart

---

## Bot Control Page (`/admin/bots`)

### Status Dashboard

Four summary cards with auto-refresh every 30 seconds:

| Card | Content | Alert Condition |
|------|---------|----------------|
| Loans Totales | Total + active count | — |
| Reserve Fund | USDC balance | < $0.01 |
| Tokens Activos | Active count + stale count | Any stale tokens |
| Alertas | Liquidatable + paused + stale | Any liquidatable loans |

### Bot Control Panel

Toggle switches for each keeper bot:

| Bot | Description | Default |
|-----|-------------|---------|
| Price Updater | Updates TWAP prices every 5 minutes | ON |
| Health Monitor | Scans loan health factors every 1 minute | ON |
| Liquidation Bot | Executes automatic liquidations | ON |
| Monitor Bot | General protocol monitoring every 2 minutes | ON |

Toggling sends a `POST` to `/api/bot/control` with the admin wallet address in the `x-wallet-address` header. Disabling a bot prevents it from executing actions; the PM2 process continues running.

### Bot Status Cards

Three status indicators with color-coded states:

| Bot | Checks | Status Colors |
|-----|--------|--------------|
| Price Updater | Stale token count | Green (0 stale) / Yellow (>0 stale) |
| Health Monitor | Liquidatable loan count | Green (0) / Red (>0) |
| Liquidation Bot | Pending liquidations | Green (0) / Red (>0) |

### TWAP Price Table

Displays all 21 monitored tokens with:

| Column | Description |
|--------|-------------|
| Token | Symbol |
| Precio | Current TWAP price in USD |
| Ultimo Update | Minutes since last update (yellow if stale) |
| LTV | Loan-to-value ratio percentage |
| Exposicion | Current / Max exposure in USD |
| Estado | OK / Stale / Pausado badge |

### Risky Loans Table

Filtered view showing loans with health factor < 1.2:

| Column | Description |
|--------|-------------|
| ID | Loan identifier |
| Borrower | Truncated address |
| Principal | USDC amount |
| Health Factor | Color-coded (red if liquidatable, yellow if risky) |
| Estado | Liquidable / Riesgoso badge |

### Active Loans Table

Complete list of all active loans with:
- Loan ID, Borrower, Lender (truncated addresses)
- Principal amount, Health Factor
- Start date

### Security & Access Control

Verifies on-chain roles across all protocol contracts:

```
+-----------------+----------------------+-------+----------+
| Contract        | Role                 | Safe  | Deployer |
+-----------------+----------------------+-------+----------+
| ProtocolConfig  | DEFAULT_ADMIN_ROLE   |  Yes  |    No    |
| ProtocolConfig  | ADMIN_ROLE           |  Yes  |    No    |
| TokenValidator  | DEFAULT_ADMIN_ROLE   |  Yes  |    No    |
| PriceOracle     | PRICE_UPDATER_ROLE   |  N/A  |   N/A    |
| ...             | ...                  |  ...  |   ...    |
+-----------------+----------------------+-------+----------+
```

Shows the Safe multisig address, deployer address, and a per-role matrix confirming which wallet holds each role.

### Keeper Configuration Reference

**Environment Variables:**
```
BOT_PRIVATE_KEY                  # Bot wallet private key
BASE_RPC_URL                     # Base RPC endpoint
DRY_RUN=true                     # Simulation mode (no transactions)
TELEGRAM_BOT_TOKEN               # Telegram alerts (optional)
TELEGRAM_CHAT_ID                 # Telegram chat ID
DISCORD_WEBHOOK_URL              # Discord alerts (optional)
FIREBASE_SERVICE_ACCOUNT_KEY     # Firebase service account path (optional)
```

**Intervals:**
| Parameter | Value |
|-----------|-------|
| Price Updater | Every 5 minutes |
| Health Monitor | Every 1 minute |
| Liquidation Bot | Every 2 minutes |
| Monitor Bot | Every 2 minutes |
| Oracle stale threshold | 30 minutes |
| Liquidation trigger | HF < 1.05 |
| Slippage tolerance | 5% |

**Execution:**
```bash
# Start keeper
node keeper/index.js

# Dry run mode
DRY_RUN=true node keeper/index.js

# Production (PM2)
pm2 start bots/ecosystem.config.cjs
```
