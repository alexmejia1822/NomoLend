/// @notice File-based watchdog for keeper bots
/// Each bot calls heartbeat(botName) on each cycle.
/// The monitor bot calls checkHeartbeats() to detect stale bots.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HEARTBEAT_FILE = path.resolve(__dirname, "..", ".keeper-heartbeat.json");

// Max allowed silence before a bot is considered stale (ms)
const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Record a heartbeat for a bot.
 * @param {string} botName — e.g. "priceUpdater", "healthMonitor", "monitorBot"
 */
export function heartbeat(botName) {
  let data = {};
  try {
    if (fs.existsSync(HEARTBEAT_FILE)) {
      const raw = fs.readFileSync(HEARTBEAT_FILE, "utf-8");
      data = JSON.parse(raw);
    }
  } catch {
    // File corrupt or unreadable — start fresh
    data = {};
  }

  data[botName] = {
    lastRun: Date.now(),
    lastRunISO: new Date().toISOString(),
  };

  fs.writeFileSync(HEARTBEAT_FILE, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * Check all bot heartbeats and return stale bots.
 * @returns {{ staleBots: Array<{ name: string, lastRun: number, staleMinutes: number }>, allBots: object }}
 */
export function checkHeartbeats() {
  let data = {};
  try {
    if (fs.existsSync(HEARTBEAT_FILE)) {
      const raw = fs.readFileSync(HEARTBEAT_FILE, "utf-8");
      data = JSON.parse(raw);
    }
  } catch {
    return { staleBots: [], allBots: {}, error: "No se pudo leer el archivo de heartbeat" };
  }

  const now = Date.now();
  const staleBots = [];

  for (const [name, info] of Object.entries(data)) {
    const lastRun = info?.lastRun;
    if (!lastRun) continue;

    const elapsed = now - lastRun;
    if (elapsed > STALE_THRESHOLD_MS) {
      staleBots.push({
        name,
        lastRun,
        staleMinutes: Math.floor(elapsed / 60_000),
      });
    }
  }

  return { staleBots, allBots: data };
}
