/// @notice Health Monitor — scans all active loans and flags risky ones
/// Checks health factor, expiration, and returns liquidatable loans

import {
  HEALTH_CHECK_INTERVAL, LIQUIDATION_TRIGGER_BPS,
  getProvider, getLoanManager,
} from "./config.js";
import { logBotAction, updateBotStatus, getBotControl } from "./firebase.js";
import { alertLoanUnderwaterDetected } from "./alerts.js";
import { heartbeat } from "./watchdog.js";

async function scanLoans() {
  const control = await getBotControl();
  if (!control.healthMonitor) {
    console.log(`[${new Date().toISOString()}] HealthMonitor DISABLED from admin panel`);
    return [];
  }

  const provider = getProvider();
  const loanManager = getLoanManager(provider);

  const nextLoanId = await loanManager.nextLoanId();
  const total = Number(nextLoanId);

  heartbeat("healthMonitor");

  if (total === 0) {
    console.log(`[${new Date().toISOString()}] No loans to monitor`);
    return [];
  }

  console.log(`[${new Date().toISOString()}] Scanning ${total} loans...`);

  const liquidatable = [];
  let activeCount = 0;
  let riskyCount = 0;

  for (let i = 0; i < total; i++) {
    try {
      const loan = await loanManager.getLoan(i);

      // Only check ACTIVE loans (status === 0)
      if (Number(loan.status) !== 0) continue;
      activeCount++;

      // Check if liquidatable
      const [expired, undercollateralized] = await loanManager.isLoanLiquidatable(i);

      if (expired || undercollateralized) {
        const reason = expired ? "EXPIRED" : "UNDERCOLLATERALIZED";
        console.log(`  ⚠ Loan #${i} is liquidatable: ${reason}`);
        console.log(`    Borrower: ${loan.borrower}`);
        console.log(`    Principal: ${(Number(loan.principal) / 1e6).toFixed(2)} USDC`);
        liquidatable.push({ loanId: i, reason, loan });

        await alertLoanUnderwaterDetected(i, reason);
        continue;
      }

      // Check health factor
      try {
        const hf = await loanManager.getLoanHealthFactor(i);
        const hfNum = Number(hf);

        if (hfNum < LIQUIDATION_TRIGGER_BPS) {
          riskyCount++;
          const hfStr = (hfNum / 10000).toFixed(3);
          console.log(`  ⚠ Loan #${i} health low: ${hfStr}`);
          await alertLoanUnderwaterDetected(i, `HF=${hfStr}`);
        }
      } catch {
        // getLoanHealthFactor may revert if debt is 0
      }
    } catch (err) {
      console.error(`  Error checking loan #${i}: ${err.message?.slice(0, 80)}`);
    }
  }

  if (liquidatable.length === 0) {
    console.log(`  Active: ${activeCount}, Risky: ${riskyCount}, Liquidatable: 0`);
  } else {
    console.log(`\n  Found ${liquidatable.length} liquidatable loans`);
  }

  await updateBotStatus("healthMonitor", {
    active: true,
    lastRun: new Date().toISOString(),
    activeLoans: activeCount,
    riskyLoans: riskyCount,
    liquidatableLoans: liquidatable.length,
  });

  return liquidatable;
}

export async function startHealthMonitor() {
  console.log("=== Health Monitor Started ===");
  console.log(`  Interval: ${HEALTH_CHECK_INTERVAL / 1000}s`);
  console.log(`  Trigger threshold: ${(LIQUIDATION_TRIGGER_BPS / 10000).toFixed(2)}x\n`);

  await scanLoans();
  setInterval(scanLoans, HEALTH_CHECK_INTERVAL);
}

export { scanLoans };

if (process.env.pm_id !== undefined || import.meta.url === `file://${process.argv[1]}`) {
  startHealthMonitor();
}
