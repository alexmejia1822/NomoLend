# NomoLend Keeper Infrastructure

Operational guide for the keeper bot infrastructure. Covers PM2 process management, Firebase remote control, alerting channels, health monitoring, and the dual-deployment model (PM2 server + Vercel Crons).

---

## Deployment Architecture

```
+===========================+          +===========================+
|     DEDICATED SERVER      |          |     VERCEL (SERVERLESS)   |
|---------------------------|          |---------------------------|
|  PM2 Process Manager      |          |  Vercel Cron Jobs         |
|                           |          |                           |
|  +---------------------+ |          |  /api/bot/update-prices   |
|  | price-updater       | |          |    every 5 min            |
|  | liquidation-bot     | |          |                           |
|  | monitor-bot         | |          |  /api/bot/scan-loans      |
|  | health-api          | |          |    every 2 min            |
|  +---------------------+ |          |                           |
|                           |          |  /api/bot/monitor         |
|  Firebase <-- logging     |          |    every 5 min            |
|  Telegram <-- alerts      |          |                           |
|  Discord  <-- alerts      |          +===========================+
+===========================+
```

---

## PM2 Ecosystem

Four independent processes managed by PM2, configured in `bots/ecosystem.config.cjs`.

### Process Table

| Process | Script | Memory Limit | Max Restarts | Restart Delay |
|---------|--------|-------------|--------------|---------------|
| `nomolend-price-updater` | `bots/priceUpdater.js` | 256 MB | 50 | 5,000 ms |
| `nomolend-liquidation-bot` | `bots/liquidationBot.js` | 256 MB | 50 | 5,000 ms |
| `nomolend-monitor-bot` | `bots/monitorBot.js` | 256 MB | 50 | 5,000 ms |
| `nomolend-health-api` | `bots/healthServer.js` | 128 MB | 20 | 3,000 ms |

### Common Settings

| Setting | Value |
|---------|-------|
| Exec mode | `fork` |
| Auto-restart | `true` |
| Min uptime | 10 seconds |
| Log format | `YYYY-MM-DD HH:mm:ss Z` |
| Merge logs | `true` |
| Environment | `NODE_ENV=production` |

### Commands

```bash
# Start all bots
pm2 start bots/ecosystem.config.cjs

# Status overview
pm2 status

# View logs (all bots)
pm2 logs

# Restart specific bot
pm2 restart nomolend-price-updater

# Stop all
pm2 stop all

# Enable PM2 startup on reboot
pm2 startup
pm2 save
```

### Log Files

| Process | stdout | stderr |
|---------|--------|--------|
| price-updater | `logs/price-updater-out.log` | `logs/price-updater-error.log` |
| liquidation-bot | `logs/liquidation-bot-out.log` | `logs/liquidation-bot-error.log` |
| monitor-bot | `logs/monitor-bot-out.log` | `logs/monitor-bot-error.log` |
| health-api | `logs/health-api-out.log` | `logs/health-api-error.log` |

---

## Firebase Remote Control

### Bot Control (`bot-config/control`)

Each bot checks Firestore for its enabled/disabled state at the start of every cycle. The control document lives at `bot-config/control`:

```json
{
  "priceUpdater": true,
  "healthMonitor": true,
  "liquidationBot": true,
  "monitorBot": true,
  "updatedAt": "2026-03-08T12:00:00.000Z"
}
```

**Cache behavior:** Control state is cached for 15 seconds to avoid excessive Firestore reads. Setting a bot to `false` takes effect within 15 seconds.

**Fallback:** If Firebase is unavailable (no service account key, network error), all bots default to `enabled`.

### Bot Status (`bot-config/status`)

Each bot writes its status after every cycle:

```json
{
  "priceUpdater": {
    "active": true,
    "lastRun": "2026-03-08T11:55:00.000Z",
    "tokensUpdated": 21,
    "lastUpdate": "2026-03-08T11:55:00.000Z"
  },
  "healthMonitor": {
    "active": true,
    "lastRun": "2026-03-08T11:55:30.000Z",
    "activeLoans": 12,
    "riskyLoans": 0,
    "liquidatableLoans": 0
  }
}
```

### Bot Logs (`bot-logs`)

Structured log entries for every action:

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO 8601 timestamp |
| `botType` | string | `priceUpdater`, `liquidationBot`, `monitorBot`, `admin` |
| `action` | string | `batch_update`, `liquidation_success`, `bot_toggle`, etc. |
| `status` | string | `success`, `error`, `info`, `warning` |
| `txHash` | string | On-chain transaction hash (if applicable) |
| `error` | string | Error message (if applicable) |
| `details` | string | Human-readable context |

### Liquidation Logs (`liquidations`)

Dedicated collection for liquidation events:

| Field | Type | Description |
|-------|------|-------------|
| `loanId` | number | On-chain loan ID |
| `token` | string | Collateral token symbol |
| `amount` | string | Principal amount (string for BigInt) |
| `txHash` | string | Transaction hash |
| `timestamp` | string | ISO 8601 |
| `status` | string | `success` or `failed` |

---

## Alerting Channels

### Telegram

Configured via environment variables:

| Variable | Description |
|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Bot API token from @BotFather |
| `TELEGRAM_CHAT_ID` | Target chat/group/channel ID |

Messages use HTML formatting (`parse_mode: HTML`).

### Discord

| Variable | Description |
|----------|-------------|
| `DISCORD_WEBHOOK_URL` | Channel webhook URL |

Messages use Markdown formatting.

### Alert Deduplication

Identical alerts (same level + title) are suppressed for 5 minutes to prevent notification spam during sustained error conditions.

### Alert Types

| Alert | Level | Source Bot |
|-------|-------|------------|
| Liquidation executed | `info` | liquidationBot |
| Liquidation FAILED | `critical` | liquidationBot |
| Loan underwater | `warning` | healthMonitor |
| Oracle stale | `warning` | monitorBot |
| Token PAUSED | `critical` | monitorBot |
| DEX liquidity low | `warning` | monitorBot |
| Reserve fund low | `warning` | monitorBot |
| Bot not responding | `critical` | monitorBot (watchdog) |
| Protocol DEGRADED | `critical` | healthServer |
| Protocol RECOVERED | `info` | healthServer |
| Bot error | `critical` | any bot |

---

## Watchdog Cross-Bot Monitoring

The watchdog system ensures all bots are running. It uses a shared JSON file (`.keeper-heartbeat.json`) as a lightweight IPC mechanism.

```
                     .keeper-heartbeat.json
                    +----------------------+
 priceUpdater ----->| priceUpdater: 11:55  |
 healthMonitor ---->| healthMonitor: 11:56 |
 liquidationBot --->| liquidationBot: 11:55|
 monitorBot ------->| monitorBot: 11:57    |<----- monitorBot reads
                    +----------------------+       (checkHeartbeats)
                                                        |
                                              stale >10 min?
                                                   |
                                            alertWatchdog()
```

**Stale threshold:** 10 minutes. If any bot has not recorded a heartbeat in over 10 minutes, the monitor bot sends a `critical` alert.

**Health server threshold:** 15 minutes. The HTTP health endpoint uses a stricter threshold to determine the `healthy`/`degraded` status returned to external monitors.

---

## Health Endpoint

The health server (`healthServer.js`) runs on port 4040 and exposes:

| Endpoint | Description | Healthy | Degraded |
|----------|-------------|---------|----------|
| `GET /health` | Overall protocol status | HTTP 200 | HTTP 503 |
| `GET /health/:botName` | Individual bot status | HTTP 200 | HTTP 503 |

External monitoring services (UptimeRobot, Pingdom, etc.) should poll `GET /health` and alert on HTTP 503.

### Degradation Detection

The health server checks for status transitions every 2 minutes:

- `healthy -> degraded`: Sends `critical` alert immediately
- `degraded -> healthy`: Sends `info` recovery notification

### Periodic Reports

Every 30 minutes, the health server sends a formatted Telegram report showing the status of all registered bots with their last run times.

---

## Vercel Cron Jobs

The frontend deployment on Vercel includes serverless cron jobs as a redundant execution layer, configured in `frontend/vercel.json`:

| Endpoint | Schedule | Equivalent Bot |
|----------|----------|----------------|
| `/api/bot/update-prices` | Every 5 minutes | Price Updater |
| `/api/bot/scan-loans` | Every 2 minutes | Health Monitor + Liquidation Bot |
| `/api/bot/monitor` | Every 5 minutes | Monitor Bot |

### PM2 vs Vercel Crons

| Aspect | PM2 (Server) | Vercel (Serverless) |
|--------|--------------|---------------------|
| Execution model | Long-running process with `setInterval` | Cold-start function per invocation |
| State | In-memory (heartbeats, provider, caches) | Stateless per invocation |
| Uptime | 24/7 with auto-restart | Function duration limit (Vercel plan) |
| Cost | Fixed server cost | Pay-per-invocation |
| Latency | Immediate (already running) | Cold-start overhead per invocation |
| Failover | PM2 auto-restart + watchdog | Vercel retries on failure |
| Logging | Local files + Firebase | Vercel logs + Firebase |
| RPC connections | Persistent, with failover rotation | New connection per invocation |

**Recommended strategy:** Run PM2 bots as the primary system on a dedicated server. Use Vercel Crons as a backup layer that activates if the PM2 bots go down. The on-chain cooldowns (5 min between price updates) prevent duplicate work when both systems are active.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `BOT_PRIVATE_KEY` | Yes | Bot wallet private key (PRICE_UPDATER + LIQUIDATOR roles) |
| `BASE_RPC_URL` | Yes | Primary Base RPC endpoint |
| `BASE_RPC_URL_2` | No | Secondary RPC endpoint |
| `BASE_RPC_URL_3` | No | Tertiary RPC endpoint |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | No | Path to Firebase service account JSON |
| `TELEGRAM_BOT_TOKEN` | No | Telegram bot token |
| `TELEGRAM_CHAT_ID` | No | Telegram chat ID |
| `DISCORD_WEBHOOK_URL` | No | Discord webhook URL |
| `HEALTH_PORT` | No | Health server port (default: 4040) |
| `DRY_RUN` | No | Set to `true` for simulation mode |
