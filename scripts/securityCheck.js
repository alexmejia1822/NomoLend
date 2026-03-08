/// @notice TASK 9: Full protocol security/status verification
/// Run: node scripts/securityCheck.js

import { ethers } from "ethers";
import {
  CONTRACTS, TOKENS, RISK_TIERS, ROUTERS,
  ProtocolConfigABI, TokenValidatorABI, PriceOracleABI,
  RiskEngineABI, CollateralManagerABI, LiquidationEngineABI,
  LoanManagerABI, OrderBookABI,
  getProvider,
} from "./shared.js";

let passed = 0;
let failed = 0;

function check(label, ok, detail = "") {
  if (ok) {
    console.log(`  ✓ ${label}${detail ? " — " + detail : ""}`);
    passed++;
  } else {
    console.log(`  ✗ ${label}${detail ? " — " + detail : ""}`);
    failed++;
  }
}

async function main() {
  const provider = getProvider();
  console.log("========================================");
  console.log("  NomoLend Protocol Security Check");
  console.log("  Network: Base Mainnet");
  console.log("========================================\n");

  // --- 1. Contract deployment verification ---
  console.log("1. CONTRACT DEPLOYMENT");
  for (const [name, addr] of Object.entries(CONTRACTS)) {
    const code = await provider.getCode(addr);
    check(name, code !== "0x", addr);
  }

  // --- 2. ProtocolConfig ---
  console.log("\n2. PROTOCOL CONFIG");
  const config = new ethers.Contract(CONTRACTS.ProtocolConfig, ProtocolConfigABI, provider);
  const usdc = await config.usdc();
  check("USDC address", usdc.toLowerCase() === CONTRACTS.USDC.toLowerCase(), usdc);
  const treasury = await config.treasury();
  check("Treasury set", treasury !== ethers.ZeroAddress, treasury);

  const primaryRouter = await config.primaryRouter();
  check("Primary router set", primaryRouter !== ethers.ZeroAddress, primaryRouter);
  const fallbackRouter = await config.fallbackRouter();
  check("Fallback router set", fallbackRouter !== ethers.ZeroAddress, fallbackRouter);

  // --- 3. LiquidationEngine routers ---
  console.log("\n3. LIQUIDATION ENGINE");
  const le = new ethers.Contract(CONTRACTS.LiquidationEngine, LiquidationEngineABI, provider);
  const lePrimary = await le.primaryRouter();
  check("Primary router", lePrimary !== ethers.ZeroAddress, lePrimary);
  const leFallback = await le.fallbackRouter();
  check("Fallback router", leFallback !== ethers.ZeroAddress, leFallback);

  // --- 4. Token whitelist & price feeds ---
  console.log("\n4. TOKEN CONFIGURATION");
  const tv = new ethers.Contract(CONTRACTS.TokenValidator, TokenValidatorABI, provider);
  const oracle = new ethers.Contract(CONTRACTS.PriceOracle, PriceOracleABI, provider);
  const risk = new ethers.Contract(CONTRACTS.RiskEngine, RiskEngineABI, provider);

  for (const [name, token] of Object.entries(TOKENS)) {
    console.log(`\n  --- ${name} (${token.address.slice(0, 10)}...) ---`);

    // Whitelist
    const whitelisted = await tv.whitelistedTokens(token.address);
    check(`${name} whitelisted`, whitelisted);

    // Price feed
    const feed = await oracle.priceFeeds(token.address);
    check(`${name} price feed active`, feed.isActive);

    // Try to get price
    try {
      const [price, confidence] = await oracle.getPrice(token.address);
      check(`${name} price available`, price > 0n, `$${(Number(price) / 1e6).toFixed(2)} USDC`);
      check(`${name} price confidence`, confidence);
    } catch (e) {
      check(`${name} price available`, false, e.message?.slice(0, 60));
    }

    // Risk params
    const params = await risk.tokenRiskParams(token.address);
    check(`${name} risk params active`, params.isActive,
      `LTV=${Number(params.ltvBps) / 100}%, Liq=${Number(params.liquidationThresholdBps) / 100}%`);

    // Exposure
    const exposure = await risk.currentExposure(token.address);
    const maxExp = params.maxExposure;
    console.log(`    Exposure: ${(Number(exposure) / 1e6).toFixed(2)} / ${(Number(maxExp) / 1e6).toFixed(2)} USDC`);

    // Paused
    const isPaused = await risk.pausedTokens(token.address);
    check(`${name} not paused`, !isPaused, isPaused ? "PAUSED!" : "OK");
  }

  // --- 5. LoanManager status ---
  console.log("\n5. LOAN MANAGER");
  const lm = new ethers.Contract(CONTRACTS.LoanManager, LoanManagerABI, provider);
  const nextLoan = await lm.nextLoanId();
  console.log(`  Total loans created: ${nextLoan}`);

  // --- 6. OrderBook status ---
  console.log("\n6. ORDER BOOK");
  const ob = new ethers.Contract(CONTRACTS.OrderBook, OrderBookABI, provider);
  const nextLending = await ob.nextLendingOrderId();
  const nextBorrow = await ob.nextBorrowRequestId();
  console.log(`  Lending orders: ${nextLending}`);
  console.log(`  Borrow requests: ${nextBorrow}`);

  // --- 7. CollateralManager ---
  console.log("\n7. COLLATERAL MANAGER");
  const cm = new ethers.Contract(CONTRACTS.CollateralManager, CollateralManagerABI, provider);
  for (const [name, token] of Object.entries(TOKENS)) {
    const total = await cm.totalCollateral(token.address);
    if (total > 0n) {
      console.log(`  ${name}: ${ethers.formatUnits(total, token.decimals)} locked`);
    }
  }
  console.log("  (empty = no collateral locked yet)");

  // --- Summary ---
  console.log("\n========================================");
  console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
  console.log("========================================\n");

  if (failed > 0) {
    console.log("⚠ Some checks failed. Review configuration.\n");
    process.exit(1);
  } else {
    console.log("Protocol is fully configured.\n");
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
