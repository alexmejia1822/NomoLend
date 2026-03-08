# NomoLend Keeper Bots

Automated off-chain services that maintain protocol health on Base. Each bot runs as an independent PM2 process with auto-restart, Firebase logging, and Telegram/Discord alerting.

---

## Architecture Overview

```
                          +------------------+
                          |   CoinGecko API  |
                          +--------+---------+
                                   |
                                   v
+------------------+     +------------------+     +------------------+
|  Price Updater   |---->|   PriceOracle    |<----|  Monitor Bot     |
|  (5 min cycle)   |     |   (on-chain)     |     |  (2 min cycle)   |
+------------------+     +------------------+     +------------------+
                                   |                       |
                                   v                       v
+------------------+     +------------------+     +------------------+
| Health Monitor   |---->|   LoanManager    |     |  Watchdog        |
| (1 min cycle)    |     |   (on-chain)     |     |  (file-based)    |
+--------+---------+     +------------------+     +------------------+
         |                                                 ^
         v                                                 |
+------------------+                              +------------------+
| Liquidation Bot  |                              |  Health Server   |
| (2 min cycle)    |                              |  (HTTP :4040)    |
+------------------+                              +------------------+
         |
         v
  [Telegram / Discord Alerts]
```

---

## Bot Reference

### 1. Price Updater (`priceUpdater.js`)

Fetches token prices from CoinGecko (free API) and DEX pools (Aerodrome CL for tokens without CoinGecko listings), then submits batch TWAP updates to the on-chain `PriceOracle`.

| Parameter | Value |
|-----------|-------|
| Interval | 5 minutes (`PRICE_UPDATE_INTERVAL`) |
| Price sources | CoinGecko API (21 tokens), Aerodrome CL pools (DEX-only tokens) |
| On-chain call | `PriceOracle.batchUpdateTwapPrices(addresses[], prices[])` |
| Retries | 3 attempts with exponential backoff (2s, 4s, 8s) |
| Firebase action | `priceUpdater` / `batch_update` |

**CoinGecko tokens:** WETH, cbETH, DAI, USDbC, LINK, UNI, CYPR, REI, AVNT, GHST, VFY, ZRO, TIG, BID, MAMO, GIZA, MOCA, AVAIL, KTA, BRETT, VIRTUAL

**DEX price tokens:** Configurable via `DEX_PRICE_TOKENS` in `config.js`. Uses `slot0()` from Aerodrome CL pools to calculate price from `sqrtPriceX96`, adjusting for token decimal differences.

**Alerts sent:**
- `critical` — Bot error (price update transaction failed after 3 retries)

---

### 2. Health Monitor (`healthMonitor.js`)

Scans every active loan on-chain, checks health factor and expiration, and flags loans eligible for liquidation.

| Parameter | Value |
|-----------|-------|
| Interval | 1 minute (`HEALTH_CHECK_INTERVAL`) |
| On-chain calls | `LoanManager.getLoan(id)`, `isLoanLiquidatable(id)`, `getLoanHealthFactor(id)` |
| Liquidation trigger | HF < 1.05 (10,500 BPS) |
| Risky threshold | HF < 1.05 (same as trigger — flags for monitoring) |
| Firebase action | `healthMonitor` / status update with active/risky/liquidatable counts |

**Trigger conditions:**
- `isLoanLiquidatable()` returns `true` for expired OR undercollateralized loans
- Health factor below `LIQUIDATION_TRIGGER_BPS` (1.05x)

**Alerts sent:**
- `warning` — Loan underwater detected (includes loan ID and health factor)

---

### 3. Liquidation Bot (`liquidationBot.js`)

Executes on-chain liquidations for eligible loans identified by the Health Monitor. Calculates slippage-protected `minAmountOut` from oracle prices.

| Parameter | Value |
|-----------|-------|
| Interval | 2 minutes (default) |
| On-chain call | `LoanManager.liquidateLoan(loanId, minAmountOut)` |
| Slippage tolerance | 5% (`LIQUIDATION_SLIPPAGE_BPS = 500`) |
| Retries | 3 attempts with exponential backoff |
| Firebase collections | `bot-logs`, `liquidations` |

**Execution flow:**
1. Calls `scanLoans()` from Health Monitor
2. For each liquidatable loan:
   - Queries `PriceOracle.getValueInUsdc()` for collateral value
   - Calculates `minAmountOut = collateralValue * (10000 - 500) / 10000`
   - Submits `liquidateLoan(loanId, minAmountOut)` transaction
3. Logs result to Firebase `liquidations` collection

**Alerts sent:**
- `info` — Liquidation executed (includes loan ID and tx hash)
- `critical` — Liquidation FAILED (includes loan ID and error message)

---

### 4. Monitor Bot (`monitorBot.js`)

Protocol-wide health checks: oracle staleness, paused tokens, reserve fund balance, DEX liquidity, and cross-bot watchdog monitoring.

| Parameter | Value |
|-----------|-------|
| Interval | 2 minutes (`MONITOR_INTERVAL`) |
| Oracle stale threshold | 30 minutes (`ORACLE_STALE_THRESHOLD`) |
| Reserve fund minimum | $10 USDC (`RESERVE_FUND_MIN_USDC`) |
| DEX liquidity minimum | $1,000 USDC |

**Checks performed per cycle:**

| Check | Condition | Alert Level |
|-------|-----------|-------------|
| Oracle staleness | Price not updated in >30 min | `warning` |
| Paused tokens | Token paused in RiskEngine | `critical` |
| Reserve fund | Balance < $10 USDC | `warning` |
| DEX liquidity | On-chain liquidity < $1,000 | `warning` |
| Watchdog | Any bot silent >10 min | `critical` |

---

### 5. Health Server (`healthServer.js`)

HTTP server exposing bot health status for external monitoring (UptimeRobot, Grafana, etc.). Sends periodic Telegram health reports and instant degradation alerts.

| Parameter | Value |
|-----------|-------|
| Port | 4040 (configurable via `HEALTH_PORT`) |
| Unhealthy threshold | 15 minutes without heartbeat |
| Health report interval | Every 30 minutes (Telegram) |
| Degradation check | Every 2 minutes |
| Startup report | 60 seconds after boot |

**Endpoints:**

| Endpoint | Response | Status Code |
|----------|----------|-------------|
| `GET /health` | Full status + all bots | 200 (healthy) / 503 (degraded) |
| `GET /health/:botName` | Individual bot status | 200 / 503 / 404 |

**Response format:**
```json
{
  "status": "healthy",
  "timestamp": "2026-03-08T12:00:00.000Z",
  "unhealthyBots": [],
  "bots": {
    "priceUpdater": {
      "lastRun": "2026-03-08T11:58:00.000Z",
      "elapsedMs": 120000,
      "elapsedMinutes": 2,
      "healthy": true
    }
  }
}
```

**Alerts sent:**
- `critical` — Protocol DEGRADED (when status transitions from healthy to degraded)
- `info` — Protocol RECOVERED (when status transitions from degraded to healthy)
- `info` — Periodic health report (every 30 min)

---

## Shared Infrastructure

### Watchdog System (`watchdog.js`)

File-based heartbeat mechanism for cross-bot monitoring. Each bot writes its last run timestamp to `.keeper-heartbeat.json` on every cycle.

| Parameter | Value |
|-----------|-------|
| Heartbeat file | `.keeper-heartbeat.json` (project root) |
| Stale threshold | 10 minutes (`STALE_THRESHOLD_MS`) |

```
Bot Cycle                Watchdog File                Monitor Bot
   |                         |                            |
   +-- heartbeat("bot") ---->| write timestamp             |
   |                         |                            |
   |                         |<--- checkHeartbeats() -----+
   |                         |     read all timestamps    |
   |                         |                            |
   |                         |     if elapsed > 10 min -->+ alertWatchdog()
```

### Multi-RPC Failover (`rpcProvider.js`)

Automatic RPC endpoint rotation on connection failure. Cycles through configured endpoints before failing.

| Priority | Source | Notes |
|----------|--------|-------|
| 1 | `BASE_RPC_URL` | Primary (e.g., Alchemy) |
| 2 | `BASE_RPC_URL_2` | Secondary provider |
| 3 | `BASE_RPC_URL_3` | Tertiary provider |
| 4 | `https://mainnet.base.org` | Public fallback (rate-limited) |

**Failover triggers:** `NETWORK_ERROR`, `SERVER_ERROR`, `TIMEOUT`, HTTP 502/503, rate limit errors, `ECONNREFUSED`.

The `withFailover(fn)` helper wraps any RPC call, automatically rotating to the next endpoint on failure. Maximum attempts = number of configured endpoints.

### Alert System (`alerts.js`)

Dual-channel notification system with deduplication.

| Channel | Configuration |
|---------|---------------|
| Telegram | `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` |
| Discord | `DISCORD_WEBHOOK_URL` |

**Alert cooldown:** 5 minutes between identical alerts (same level + title).

**Alert levels:**

| Level | Use Case |
|-------|----------|
| `critical` | Liquidation failed, bot unresponsive, token paused, protocol degraded |
| `warning` | Oracle stale, loan underwater, DEX liquidity low, reserve fund low |
| `info` | Liquidation executed, protocol recovered, health reports |

### Firebase Integration (`firebase.js`)

Optional Firestore backend for structured logging and remote bot control.

**Collections:**

| Collection | Purpose |
|------------|---------|
| `bot-logs` | Timestamped action log (bot type, action, status, tx hash, error) |
| `bot-config/control` | Remote ON/OFF per bot (cached 15s) |
| `bot-config/status` | Bot status dashboard (last run, metrics) |
| `liquidations` | Liquidation event log (loan ID, token, amount, tx hash, status) |

**Remote control:** Each bot checks `getBotControl()` at the start of every cycle. Returns cached value (15s TTL) to avoid excessive Firestore reads. If Firebase is unavailable, all bots default to enabled.

---

## DRY_RUN Mode

Set `DRY_RUN=true` in environment to enable simulation mode:

- Price Updater: fetches prices, logs what it would update, but submits no transactions
- Liquidation Bot: identifies liquidatable loans, calculates slippage, but does not execute
- All actions are logged to Firebase with `status: "info"` and `action: "dry_run"`

---

## Configuration Summary

All constants are defined in `bots/config.js`:

| Constant | Value | Description |
|----------|-------|-------------|
| `PRICE_UPDATE_INTERVAL` | 5 min | TWAP price update frequency |
| `HEALTH_CHECK_INTERVAL` | 1 min | Loan health scan frequency |
| `MONITOR_INTERVAL` | 2 min | Protocol monitoring frequency |
| `LIQUIDATION_TRIGGER_BPS` | 10,500 (1.05x) | Health factor liquidation threshold |
| `LIQUIDATION_SLIPPAGE_BPS` | 500 (5%) | Max slippage on liquidation swaps |
| `WATCHDOG_THRESHOLD_MIN` | 10 min | Bot silence alert threshold |
| `RESERVE_FUND_MIN_USDC` | $10 | Minimum reserve balance alert |
| `ORACLE_STALE_THRESHOLD` | 30 min | Price staleness alert threshold |
| `DRY_RUN` | `false` | Simulation mode (no transactions) |

---

## Threshold Reference

| Threshold | Value | Trigger |
|-----------|-------|---------|
| HF < 1.05 | 10,500 BPS | Loan flagged as liquidatable |
| HF < 1.2 | — | Loan flagged as risky (alert only) |
| Oracle stale | >30 min | Oracle staleness warning |
| Watchdog stale | >10 min | Bot unresponsive critical alert |
| Health server unhealthy | >15 min | Bot marked unhealthy in /health API |
| DEX liquidity low | <$1,000 | DEX liquidity warning |
| Exposure >80% | >80% max | Exposure concentration alert |
| Alert cooldown | 5 min | Deduplication window for identical alerts |
