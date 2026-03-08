/// @notice Liquidation Bot — executes liquidations on eligible loans
/// Includes slippage protection, retry logic, Firebase logging, alerts

import { ethers } from "ethers";
import {
  LIQUIDATION_SLIPPAGE_BPS, DRY_RUN,
  getSigner, getLoanManager, getPriceOracle,
  TOKENS,
} from "./config.js";
import { DEX_PRICE_TOKENS } from "./config.js";
import { scanLoans } from "./healthMonitor.js";
import { logBotAction, logLiquidation, updateBotStatus, getBotControl } from "./firebase.js";
import { alertLiquidationExecuted, alertLiquidationFailed } from "./alerts.js";

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Build a reverse map: token address -> token info
const TOKEN_BY_ADDRESS = {};
for (const [symbol, info] of Object.entries(TOKENS)) {
  TOKEN_BY_ADDRESS[info.address.toLowerCase()] = { symbol, ...info };
}
for (const [symbol, info] of Object.entries(DEX_PRICE_TOKENS)) {
  TOKEN_BY_ADDRESS[info.address.toLowerCase()] = { symbol, ...info };
}

async function executeLiquidation(loanId, loan) {
  const signer = getSigner();
  const loanManager = getLoanManager(signer);
  const oracle = getPriceOracle(signer);

  const tokenAddr = loan.collateralToken;
  const tokenInfo = TOKEN_BY_ADDRESS[tokenAddr.toLowerCase()];
  const symbol = tokenInfo?.symbol || tokenAddr.slice(0, 10);

  console.log(`\n  Liquidating loan #${loanId} (${symbol})...`);

  try {
    // Get collateral value to calculate minAmountOut
    const collateralValue = await oracle.getValueInUsdc(tokenAddr, loan.collateralAmount);

    // Apply slippage tolerance
    const minAmountOut = collateralValue * BigInt(10000 - LIQUIDATION_SLIPPAGE_BPS) / 10000n;

    console.log(`    Collateral value: $${(Number(collateralValue) / 1e6).toFixed(2)} USDC`);
    console.log(`    Min amount out:   $${(Number(minAmountOut) / 1e6).toFixed(2)} USDC (${LIQUIDATION_SLIPPAGE_BPS / 100}% slippage)`);

    if (DRY_RUN) {
      console.log(`    [DRY RUN] Would liquidate loan #${loanId}`);
      await logBotAction("liquidationBot", "dry_run_liquidation", {
        status: "info",
        details: `Loan #${loanId}, ${symbol}`,
      });
      return true;
    }

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const tx = await loanManager.liquidateLoan(loanId, minAmountOut);
        const receipt = await tx.wait();
        console.log(`    Liquidated (tx: ${receipt.hash})`);
        console.log(`    Gas used: ${receipt.gasUsed.toString()}`);

        await logLiquidation(loanId, symbol, loan.principal, receipt.hash, "success");
        await alertLiquidationExecuted(loanId, receipt.hash);
        await logBotAction("liquidationBot", "liquidation_success", {
          status: "success",
          txHash: receipt.hash,
          details: `Loan #${loanId}, ${symbol}`,
        });
        return true;
      } catch (txErr) {
        if (attempt === MAX_RETRIES) throw txErr;
        const delay = BASE_DELAY_MS * 2 ** (attempt - 1);
        console.log(`    Tx retry ${attempt}/${MAX_RETRIES} in ${delay}ms: ${txErr.message?.slice(0, 80)}`);
        await sleep(delay);
      }
    }
    return true;
  } catch (err) {
    const errMsg = err.reason || err.message?.slice(0, 120);
    console.error(`    Liquidation failed: ${errMsg}`);
    await logLiquidation(loanId, symbol, loan.principal, null, "failed");
    await alertLiquidationFailed(loanId, errMsg);
    await logBotAction("liquidationBot", "liquidation_failed", {
      status: "error",
      error: errMsg,
      details: `Loan #${loanId}, ${symbol}`,
    });
    return false;
  }
}

async function runLiquidationCycle() {
  const control = await getBotControl();
  if (!control.liquidationBot) {
    console.log(`[${new Date().toISOString()}] LiquidationBot DISABLED from admin panel`);
    return;
  }

  console.log(`\n[${new Date().toISOString()}] Running liquidation cycle...`);

  const liquidatable = await scanLoans();

  if (liquidatable.length === 0) {
    console.log("  No loans to liquidate");
    return;
  }

  let success = 0;
  let failed = 0;

  for (const { loanId, reason, loan } of liquidatable) {
    const ok = await executeLiquidation(loanId, loan);
    if (ok) success++;
    else failed++;
  }

  console.log(`\n  Liquidation results: ${success} success, ${failed} failed`);

  await updateBotStatus("liquidationBot", {
    active: true,
    lastRun: new Date().toISOString(),
    lastSuccess: success,
    lastFailed: failed,
  });
}

export async function startLiquidationBot(intervalMs = 2 * 60 * 1000) {
  console.log("=== Liquidation Bot Started ===");
  console.log(`  Slippage: ${LIQUIDATION_SLIPPAGE_BPS / 100}%`);
  console.log(`  DRY_RUN: ${DRY_RUN}`);
  console.log(`  Interval: ${intervalMs / 1000}s\n`);

  await runLiquidationCycle();
  setInterval(runLiquidationCycle, intervalMs);
}

if (process.env.pm_id !== undefined || import.meta.url === `file://${process.argv[1]}`) {
  startLiquidationBot();
}
