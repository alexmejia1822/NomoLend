/// @notice TASK 1+2+3: Whitelist tokens, set price feeds, configure risk parameters
/// Run: node scripts/configureTokens.js

import { ethers } from "ethers";
import {
  CONTRACTS, TOKENS, RISK_TIERS, DEFAULT_MAX_EXPOSURE,
  TokenValidatorABI, PriceOracleABI, RiskEngineABI, getSigner,
} from "./shared.js";

async function main() {
  const signer = getSigner();
  console.log("Configurator:", signer.address);
  console.log("Network: Base Mainnet\n");

  const tokenValidator = new ethers.Contract(CONTRACTS.TokenValidator, TokenValidatorABI, signer);
  const priceOracle = new ethers.Contract(CONTRACTS.PriceOracle, PriceOracleABI, signer);
  const riskEngine = new ethers.Contract(CONTRACTS.RiskEngine, RiskEngineABI, signer);

  for (const [name, token] of Object.entries(TOKENS)) {
    console.log(`\n========== ${name} ==========`);
    console.log(`  Address:   ${token.address}`);
    console.log(`  Decimals:  ${token.decimals}`);
    console.log(`  Tier:      ${token.tier} (${RISK_TIERS[token.tier].label})`);

    // --- Step 1: Whitelist in TokenValidator ---
    const isWhitelisted = await tokenValidator.whitelistedTokens(token.address);
    if (isWhitelisted) {
      console.log("  [TokenValidator] Already whitelisted");
    } else {
      console.log("  [TokenValidator] Whitelisting...");
      const tx1 = await tokenValidator.whitelistToken(token.address);
      await tx1.wait();
      console.log("  [TokenValidator] Whitelisted ✓");
    }

    // --- Step 2: Set price feed in PriceOracle ---
    const feed = await priceOracle.priceFeeds(token.address);
    if (feed.isActive) {
      console.log("  [PriceOracle] Feed already active");
    } else {
      console.log(`  [PriceOracle] Setting feed: ${token.chainlinkFeed || "TWAP only"}`);
      const tx2 = await priceOracle.setPriceFeed(
        token.address,
        token.chainlinkFeed,
        token.decimals
      );
      await tx2.wait();
      console.log("  [PriceOracle] Feed configured ✓");
    }

    // --- Step 3: Set risk params in RiskEngine ---
    const params = await riskEngine.tokenRiskParams(token.address);
    const tier = RISK_TIERS[token.tier];
    if (params.isActive) {
      console.log(`  [RiskEngine] Already active (LTV: ${params.ltvBps}bps)`);
    } else {
      console.log(`  [RiskEngine] Setting risk: LTV=${tier.ltvBps}bps, Liq=${tier.liquidationBps}bps`);
      const tx3 = await riskEngine.setTokenRiskParams(
        token.address,
        tier.ltvBps,
        tier.liquidationBps,
        DEFAULT_MAX_EXPOSURE
      );
      await tx3.wait();
      console.log("  [RiskEngine] Risk params set ✓");
    }
  }

  console.log("\n========== TOKEN CONFIGURATION COMPLETE ==========\n");
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
