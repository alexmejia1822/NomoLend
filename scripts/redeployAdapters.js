import pkg from "hardhat";
const { ethers } = pkg;
import { CONTRACTS, ProtocolConfigABI, LiquidationEngineABI } from "./shared.js";

/// @notice Redeploy adapter contracts and update router references
/// @dev Run: npx hardhat run scripts/redeployAdapters.js --network base
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Redeploying adapters with account:", deployer.address);
  console.log("Balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH\n");

  const UNISWAP_V3_ROUTER = "0x2626664c2603336E57B271c5C0b26F421741e481";
  const AERODROME_ROUTER = "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43";
  const AERODROME_FACTORY = "0x420DD381b31aEf6683db6B902084cB0FFECe40Da";

  // 1. Deploy new UniswapV3Adapter
  console.log("1. Deploying UniswapV3Adapter (typed interface)...");
  const UniAdapter = await ethers.getContractFactory("UniswapV3Adapter");
  const uniAdapter = await UniAdapter.deploy(UNISWAP_V3_ROUTER);
  await uniAdapter.waitForDeployment();
  const uniAddr = await uniAdapter.getAddress();
  console.log("   UniswapV3Adapter:", uniAddr);

  // 2. Deploy new AerodromeAdapter
  console.log("2. Deploying AerodromeAdapter (typed interface)...");
  const AeroAdapter = await ethers.getContractFactory("AerodromeAdapter");
  const aeroAdapter = await AeroAdapter.deploy(AERODROME_ROUTER, AERODROME_FACTORY);
  await aeroAdapter.waitForDeployment();
  const aeroAddr = await aeroAdapter.getAddress();
  console.log("   AerodromeAdapter:", aeroAddr);

  // 3. Update ProtocolConfig routers
  console.log("\n3. Updating ProtocolConfig routers...");
  const config = new ethers.Contract(CONTRACTS.ProtocolConfig, ProtocolConfigABI, deployer);
  await config.setPrimaryRouter(uniAddr);
  await config.setFallbackRouter(aeroAddr);
  console.log("   ProtocolConfig routers updated");

  // 4. Update LiquidationEngine routers
  console.log("4. Updating LiquidationEngine routers...");
  const liquidation = new ethers.Contract(CONTRACTS.LiquidationEngine, LiquidationEngineABI, deployer);
  await liquidation.setPrimaryRouter(uniAddr);
  await liquidation.setFallbackRouter(aeroAddr);
  console.log("   LiquidationEngine routers updated");

  console.log("\n========== ADAPTER REDEPLOYMENT COMPLETE ==========");
  console.log("UniswapV3Adapter:  ", uniAddr);
  console.log("AerodromeAdapter:  ", aeroAddr);
  console.log("====================================================");
  console.log("\nUpdate shared.js and frontend/lib/contracts.ts with new addresses!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
