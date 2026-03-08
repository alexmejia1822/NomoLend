/// @notice Main keeper entry point — runs all services
/// Run: node bots/index.js
/// DRY_RUN=true node bots/index.js  (no transactions)

import "dotenv/config";
import { startPriceUpdater } from "./priceUpdater.js";
import { startHealthMonitor } from "./healthMonitor.js";
import { startLiquidationBot } from "./liquidationBot.js";
import { startMonitorBot } from "./monitorBot.js";
import { DRY_RUN } from "./config.js";

async function main() {
  console.log("╔════════════════════════════════════════╗");
  console.log("║    NomoLend Keeper Service              ║");
  console.log("║    Network: Base Mainnet                ║");
  console.log(`║    Mode: ${DRY_RUN ? "DRY RUN (no txs)" : "LIVE"}${DRY_RUN ? "             " : "                         "}║`);
  console.log("╚════════════════════════════════════════╝\n");

  // Start all services concurrently
  await Promise.all([
    startPriceUpdater(),
    startHealthMonitor(),
    startLiquidationBot(),
    startMonitorBot(),
  ]);
}

main().catch((err) => {
  console.error("Keeper fatal error:", err);
  process.exit(1);
});
