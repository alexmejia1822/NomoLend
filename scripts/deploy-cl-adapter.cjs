/**
 * Deploy AerodromeAdapter con CL Pool Factory para pools CL100 (CYPR/USDC)
 *
 * npx hardhat run scripts/deploy-cl-adapter.js --network base
 */
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const AERO_ROUTER = "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43";
  const CL_FACTORY  = "0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A";

  console.log("Deploying AerodromeAdapter (CL factory)...");
  const Adapter = await ethers.getContractFactory("AerodromeAdapter");
  const adapter = await Adapter.deploy(AERO_ROUTER, CL_FACTORY);
  await adapter.waitForDeployment();
  const addr = await adapter.getAddress();
  console.log("AerodromeAdapter (CL):", addr);

  // Update LiquidationEngine fallback router
  const LE_ADDRESS = "0x6e892AEadda28E630bbe84e469fdA25f1B1B4820";
  const le = await ethers.getContractAt("LiquidationEngine", LE_ADDRESS);

  console.log("Setting as fallback router on LiquidationEngine...");
  const tx = await le.setFallbackRouter(addr);
  await tx.wait();
  console.log("Done! Fallback router updated to CL adapter");

  // Verify
  console.log("\nVerification:");
  console.log("  primaryRouter:", await le.primaryRouter());
  console.log("  fallbackRouter:", await le.fallbackRouter());
}

main().catch((err) => { console.error(err); process.exit(1); });
