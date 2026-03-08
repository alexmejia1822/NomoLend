/// @notice Health check HTTP server for NomoLend keeper bots
/// Exposes /health endpoint for external monitoring (UptimeRobot, etc.)
/// Sends periodic Telegram health reports + immediate degradation alerts
///
/// Endpoints:
///   GET /health     — Overall status + per-bot status
///   GET /health/bot — Individual bot status (e.g. /health/priceUpdater)

import http from "node:http";
import { checkHeartbeats } from "./watchdog.js";
import { sendAlert } from "./alerts.js";
import "dotenv/config";

const PORT = parseInt(process.env.HEALTH_PORT || "4040", 10);

// Max staleness before a bot is considered unhealthy (ms)
const UNHEALTHY_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes

// Telegram health report interval (30 min)
const REPORT_INTERVAL_MS = 30 * 60 * 1000;

// Track previous status for degradation detection
let previousStatus = "healthy";

function getBotHealth() {
  const { staleBots, allBots } = checkHeartbeats();
  const now = Date.now();

  const bots = {};
  for (const [name, info] of Object.entries(allBots)) {
    const elapsed = now - (info?.lastRun || 0);
    bots[name] = {
      lastRun: info?.lastRunISO || null,
      elapsedMs: elapsed,
      elapsedMinutes: Math.floor(elapsed / 60_000),
      healthy: elapsed < UNHEALTHY_THRESHOLD_MS,
    };
  }

  const unhealthyBots = Object.entries(bots)
    .filter(([, b]) => !b.healthy)
    .map(([name]) => name);

  return {
    status: unhealthyBots.length === 0 ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    unhealthyBots,
    bots,
  };
}

const server = http.createServer((req, res) => {
  res.setHeader("Content-Type", "application/json");

  if (req.url === "/health" || req.url === "/") {
    const health = getBotHealth();
    const statusCode = health.status === "healthy" ? 200 : 503;
    res.writeHead(statusCode);
    res.end(JSON.stringify(health, null, 2));
    return;
  }

  // /health/:botName
  const botMatch = req.url?.match(/^\/health\/(\w+)$/);
  if (botMatch) {
    const health = getBotHealth();
    const botName = botMatch[1];
    const bot = health.bots[botName];
    if (!bot) {
      res.writeHead(404);
      res.end(JSON.stringify({ error: `Bot "${botName}" not found` }));
      return;
    }
    const statusCode = bot.healthy ? 200 : 503;
    res.writeHead(statusCode);
    res.end(JSON.stringify({ botName, ...bot }, null, 2));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: "Not found. Use /health" }));
});

// ============================================================
//  TELEGRAM HEALTH REPORTS
// ============================================================

async function sendHealthReport() {
  const health = getBotHealth();
  const botCount = Object.keys(health.bots).length;

  if (botCount === 0) {
    console.log(`[${new Date().toISOString()}] Health report: no bots registered yet`);
    return;
  }

  const lines = [`<b>NomoLend Health Report</b>`];
  lines.push(`Status: ${health.status === "healthy" ? "✅ Healthy" : "🔴 Degraded"}`);
  lines.push("");

  for (const [name, bot] of Object.entries(health.bots)) {
    const icon = bot.healthy ? "✅" : "❌";
    const ago = bot.elapsedMinutes < 1 ? "<1 min ago" : `${bot.elapsedMinutes} min ago`;
    lines.push(`${icon} <b>${name}</b> — ${ago}`);
  }

  if (health.unhealthyBots.length > 0) {
    lines.push("");
    lines.push(`⚠️ Unhealthy: ${health.unhealthyBots.join(", ")}`);
  }

  await sendAlert("info", lines.join("\n"));

  // Check for status degradation
  if (health.status === "degraded" && previousStatus === "healthy") {
    await sendAlert("critical", "Protocol DEGRADED", `Bots down: ${health.unhealthyBots.join(", ")}`);
  } else if (health.status === "healthy" && previousStatus === "degraded") {
    await sendAlert("info", "Protocol RECOVERED", "All bots healthy again");
  }

  previousStatus = health.status;
}

async function checkDegradation() {
  const health = getBotHealth();

  if (health.status === "degraded" && previousStatus === "healthy") {
    await sendAlert("critical", "Protocol DEGRADED", `Bots down: ${health.unhealthyBots.join(", ")}`);
    previousStatus = "degraded";
  } else if (health.status === "healthy" && previousStatus === "degraded") {
    await sendAlert("info", "Protocol RECOVERED", "All bots healthy again");
    previousStatus = "healthy";
  }
}

// Periodic health report every 30 min
setInterval(sendHealthReport, REPORT_INTERVAL_MS);

// Check for degradation every 2 min (fast detection)
setInterval(checkDegradation, 2 * 60 * 1000);

// Send startup report after 60s (allow bots to register heartbeats)
setTimeout(sendHealthReport, 60 * 1000);

server.listen(PORT, () => {
  console.log(`=== Health API listening on port ${PORT} ===`);
  console.log(`  GET http://localhost:${PORT}/health`);
  console.log(`  GET http://localhost:${PORT}/health/priceUpdater`);
  console.log(`  Telegram reports: every ${REPORT_INTERVAL_MS / 60000} min`);
  console.log(`  Degradation check: every 2 min`);
});
