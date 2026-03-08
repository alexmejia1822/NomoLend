/// @notice Grant PRICE_UPDATER_ROLE and LIQUIDATOR_ROLE to the bot wallet
import { ethers } from "ethers";
import "dotenv/config";
import {
  CONTRACTS, getSigner,
  PriceOracleABI, LoanManagerABI,
} from "./shared.js";

async function main() {
  const signer = getSigner();

  // Determine bot address: use BOT_PRIVATE_KEY if available, else deployer is the bot
  const botPk = process.env.BOT_PRIVATE_KEY;
  let botAddress;
  if (botPk) {
    const botWallet = new ethers.Wallet(botPk);
    botAddress = botWallet.address;
  } else {
    botAddress = signer.address;
    console.log("  (No BOT_PRIVATE_KEY found, using DEPLOYER as bot wallet)");
  }

  console.log(`\n=== Grant Bot Roles ===`);
  console.log(`  Bot address: ${botAddress}`);
  console.log(`  Signer (admin): ${signer.address}\n`);

  // --- PriceOracle: PRICE_UPDATER_ROLE ---
  const oracle = new ethers.Contract(CONTRACTS.PriceOracle, PriceOracleABI, signer);

  console.log("--- PriceOracle ---");
  const priceUpdaterRole = await oracle.PRICE_UPDATER_ROLE();
  console.log(`  PRICE_UPDATER_ROLE: ${priceUpdaterRole}`);

  const hasPriceRole = await oracle.hasRole(priceUpdaterRole, botAddress);
  if (hasPriceRole) {
    console.log(`  Bot already has PRICE_UPDATER_ROLE`);
  } else {
    console.log(`  Granting PRICE_UPDATER_ROLE...`);
    const tx1 = await oracle.grantRole(priceUpdaterRole, botAddress);
    console.log(`  tx: ${tx1.hash}`);
    await tx1.wait();
    console.log(`  Granted PRICE_UPDATER_ROLE`);
  }

  // --- LoanManager: LIQUIDATOR_ROLE ---
  const loanManager = new ethers.Contract(CONTRACTS.LoanManager, LoanManagerABI, signer);

  console.log("\n--- LoanManager ---");
  const liquidatorRole = await loanManager.LIQUIDATOR_ROLE();
  console.log(`  LIQUIDATOR_ROLE: ${liquidatorRole}`);

  const hasLiqRole = await loanManager.hasRole(liquidatorRole, botAddress);
  if (hasLiqRole) {
    console.log(`  Bot already has LIQUIDATOR_ROLE`);
  } else {
    console.log(`  Granting LIQUIDATOR_ROLE...`);
    const tx2 = await loanManager.grantRole(liquidatorRole, botAddress);
    console.log(`  tx: ${tx2.hash}`);
    await tx2.wait();
    console.log(`  Granted LIQUIDATOR_ROLE`);
  }

  console.log("\n=== Done ===\n");
}

main().catch((err) => {
  console.error("Error:", err.message || err);
  process.exit(1);
});
