/// @notice Monitoring Bot — checks protocol health, oracle staleness, DEX liquidity
/// Sends alerts on anomalies

import { ethers } from "ethers";
import {
  MONITOR_INTERVAL, ORACLE_STALE_THRESHOLD, RESERVE_FUND_MIN_USDC, WATCHDOG_THRESHOLD_MIN,
  TOKENS, CONTRACTS, DRY_RUN,
  getProvider, getPriceOracle, getRiskEngine,
} from "./config.js";
import { DEX_PRICE_TOKENS } from "./config.js";
import { logBotAction, updateBotStatus, getBotControl } from "./firebase.js";
import {
  alertOracleStale, alertTokenPaused, alertDexLiquidityLow,
  alertReserveFundLow, alertWatchdog,
} from "./alerts.js";
import { heartbeat, checkHeartbeats } from "./watchdog.js";

const ERC20_BALANCE_ABI = ["function balanceOf(address) view returns (uint256)"];
const RESERVE_ABI = ["function getReserveBalance() view returns (uint256)"];

// Track last run times for watchdog
const lastRunTimes = {};

async function checkOracleHealth(provider) {
  const oracle = getPriceOracle(provider);
  const now = Math.floor(Date.now() / 1000);
  let issues = 0;

  const allTokens = { ...TOKENS, ...DEX_PRICE_TOKENS };

  for (const [symbol, info] of Object.entries(allTokens)) {
    try {
      const feed = await oracle.priceFeeds(info.address);
      if (!feed.isActive) continue;

      const lastUpdate = Number(feed.lastTwapUpdate);
      const staleness = now - lastUpdate;
      const price = Number(feed.twapPrice) / 1e6;

      if (staleness > ORACLE_STALE_THRESHOLD) {
        console.log(`  ⚠ ${symbol}: STALE (${Math.floor(staleness / 60)} min, price: $${price.toFixed(4)})`);
        await alertOracleStale(symbol, staleness);
        issues++;
      } else {
        console.log(`  ✓ ${symbol}: $${price.toFixed(4)} (${Math.floor(staleness / 60)}m ago)`);
      }
    } catch (err) {
      console.error(`  ✗ ${symbol}: error — ${err.message?.slice(0, 60)}`);
    }
  }

  return issues;
}

async function checkPausedTokens(provider) {
  const riskEngine = getRiskEngine(provider);
  let issues = 0;

  const allTokens = { ...TOKENS, ...DEX_PRICE_TOKENS };

  for (const [symbol, info] of Object.entries(allTokens)) {
    try {
      const paused = await riskEngine.pausedTokens(info.address);
      if (paused) {
        console.log(`  🚫 ${symbol}: PAUSADO`);
        await alertTokenPaused(symbol, "Token pausado en RiskEngine");
        issues++;
      }
    } catch {}
  }

  return issues;
}

async function checkReserveFund(provider) {
  try {
    const reserve = new ethers.Contract(CONTRACTS.ReserveFund, RESERVE_ABI, provider);
    const balance = await reserve.getReserveBalance();
    const balanceUsdc = Number(balance) / 1e6;

    console.log(`  Reserve Fund: $${balanceUsdc.toFixed(2)} USDC`);

    if (balanceUsdc < RESERVE_FUND_MIN_USDC) {
      await alertReserveFundLow(balanceUsdc.toFixed(2));
      return 1;
    }
  } catch (err) {
    console.error(`  Reserve Fund check error: ${err.message?.slice(0, 60)}`);
  }
  return 0;
}

async function checkDexLiquidity(provider) {
  const riskEngine = getRiskEngine(provider);
  let issues = 0;

  const allTokens = { ...TOKENS, ...DEX_PRICE_TOKENS };

  for (const [symbol, info] of Object.entries(allTokens)) {
    try {
      const params = await riskEngine.tokenRiskParams(info.address);
      if (!params.isActive) continue;

      const liq = await riskEngine.tokenDexLiquidity(info.address);
      const liqUsdc = Number(liq) / 1e6;

      if (liqUsdc > 0 && liqUsdc < 1000) {
        console.log(`  ⚠ ${symbol}: DEX liquidity baja ($${liqUsdc.toFixed(0)})`);
        await alertDexLiquidityLow(symbol, liqUsdc.toFixed(0));
        issues++;
      }
    } catch {}
  }

  return issues;
}

async function runMonitorCycle() {
  const control = await getBotControl();
  if (!control.monitorBot) {
    console.log(`[${new Date().toISOString()}] MonitorBot DISABLED from admin panel`);
    return;
  }

  const timestamp = new Date().toISOString();
  console.log(`\n[${timestamp}] Running monitor cycle...`);

  const provider = getProvider();
  let totalIssues = 0;

  // 1. Oracle health
  console.log("\n  --- Oracle Health ---");
  totalIssues += await checkOracleHealth(provider);

  // 2. Paused tokens
  console.log("\n  --- Paused Tokens ---");
  totalIssues += await checkPausedTokens(provider);

  // 3. Reserve Fund
  console.log("\n  --- Reserve Fund ---");
  totalIssues += await checkReserveFund(provider);

  // 4. DEX liquidity
  console.log("\n  --- DEX Liquidity ---");
  totalIssues += await checkDexLiquidity(provider);

  // 5. Watchdog: check if other bots are running
  console.log("\n  --- Watchdog ---");
  // Record own heartbeat
  heartbeat("monitorBot");

  const { staleBots, allBots } = checkHeartbeats();
  if (staleBots.length > 0) {
    for (const bot of staleBots) {
      console.log(`  ⚠ ${bot.name}: no responde (${bot.staleMinutes} min sin actividad)`);
      await alertWatchdog(bot.name, bot.staleMinutes);
      totalIssues++;
    }
  } else {
    const botNames = Object.keys(allBots);
    if (botNames.length > 0) {
      console.log(`  ✓ Todos los bots activos: ${botNames.join(", ")}`);
    } else {
      console.log("  (Sin datos de heartbeat todavia)");
    }
  }

  const status = totalIssues === 0 ? "healthy" : `${totalIssues} issues`;
  console.log(`\n  Protocol status: ${status}`);

  await logBotAction("monitorBot", "monitor_cycle", {
    status: totalIssues === 0 ? "success" : "warning",
    details: status,
  });

  await updateBotStatus("monitorBot", {
    active: true,
    lastRun: timestamp,
    issues: totalIssues,
  });
}

export async function startMonitorBot() {
  console.log("=== Monitor Bot Started ===");
  console.log(`  Interval: ${MONITOR_INTERVAL / 1000}s`);
  console.log(`  Oracle stale threshold: ${ORACLE_STALE_THRESHOLD / 60} min`);
  console.log(`  Reserve Fund min: $${RESERVE_FUND_MIN_USDC}\n`);

  await runMonitorCycle();
  setInterval(runMonitorCycle, MONITOR_INTERVAL);
}

if (process.env.pm_id !== undefined || import.meta.url === `file://${process.argv[1]}`) {
  startMonitorBot();
}
