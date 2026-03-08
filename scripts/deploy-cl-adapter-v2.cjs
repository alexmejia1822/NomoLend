/**
 * Deploy AerodromeCLAdapter (Slipstream CL Router) y configurar en LiquidationEngine
 *
 * npx hardhat run scripts/deploy-cl-adapter-v2.cjs --network base
 */
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // Aerodrome Slipstream CL SwapRouter on Base
  const CL_SWAP_ROUTER = "0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5";

  console.log("Deploying AerodromeCLAdapter...");
  const Adapter = await ethers.getContractFactory("AerodromeCLAdapter");
  const adapter = await Adapter.deploy(CL_SWAP_ROUTER);
  await adapter.waitForDeployment();
  const addr = await adapter.getAddress();
  console.log("AerodromeCLAdapter:", addr);

  // Update LiquidationEngine: CL adapter as primary
  const LE_ADDRESS = "0x6e892AEadda28E630bbe84e469fdA25f1B1B4820";
  const le = await ethers.getContractAt("LiquidationEngine", LE_ADDRESS);

  console.log("Setting as primary router on LiquidationEngine...");
  const tx = await le.setPrimaryRouter(addr);
  await tx.wait();
  console.log("Done!");

  // Verify
  console.log("\nVerification:");
  console.log("  primaryRouter:", await le.primaryRouter());
  console.log("  fallbackRouter:", await le.fallbackRouter());
}

main().catch((err) => { console.error(err); process.exit(1); });
