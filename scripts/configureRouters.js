/// @notice TASK 4: Configure DEX routers for liquidations
/// Run: node scripts/configureRouters.js

import { ethers } from "ethers";
import {
  CONTRACTS, ROUTERS,
  ProtocolConfigABI, LiquidationEngineABI, getSigner,
} from "./shared.js";

async function main() {
  const signer = getSigner();
  console.log("Configurator:", signer.address);
  console.log("Network: Base Mainnet\n");

  const protocolConfig = new ethers.Contract(CONTRACTS.ProtocolConfig, ProtocolConfigABI, signer);
  const liquidationEngine = new ethers.Contract(CONTRACTS.LiquidationEngine, LiquidationEngineABI, signer);

  // --- ProtocolConfig routers ---
  console.log("=== ProtocolConfig ===");

  const currentPrimary = await protocolConfig.primaryRouter();
  if (currentPrimary.toLowerCase() === ROUTERS.uniswapV3.toLowerCase()) {
    console.log("  Primary router already set:", currentPrimary);
  } else {
    console.log("  Setting primary router (Uniswap V3):", ROUTERS.uniswapV3);
    const tx1 = await protocolConfig.setPrimaryRouter(ROUTERS.uniswapV3);
    await tx1.wait();
    console.log("  Primary router set ✓");
  }

  const currentFallback = await protocolConfig.fallbackRouter();
  if (currentFallback.toLowerCase() === ROUTERS.aerodrome.toLowerCase()) {
    console.log("  Fallback router already set:", currentFallback);
  } else {
    console.log("  Setting fallback router (Aerodrome):", ROUTERS.aerodrome);
    const tx2 = await protocolConfig.setFallbackRouter(ROUTERS.aerodrome);
    await tx2.wait();
    console.log("  Fallback router set ✓");
  }

  // --- LiquidationEngine routers ---
  console.log("\n=== LiquidationEngine ===");

  const lePrimary = await liquidationEngine.primaryRouter();
  if (lePrimary.toLowerCase() === ROUTERS.uniswapV3.toLowerCase()) {
    console.log("  Primary router already set:", lePrimary);
  } else {
    console.log("  Setting primary router (Uniswap V3):", ROUTERS.uniswapV3);
    const tx3 = await liquidationEngine.setPrimaryRouter(ROUTERS.uniswapV3);
    await tx3.wait();
    console.log("  Primary router set ✓");
  }

  const leFallback = await liquidationEngine.fallbackRouter();
  if (leFallback.toLowerCase() === ROUTERS.aerodrome.toLowerCase()) {
    console.log("  Fallback router already set:", leFallback);
  } else {
    console.log("  Setting fallback router (Aerodrome):", ROUTERS.aerodrome);
    const tx4 = await liquidationEngine.setFallbackRouter(ROUTERS.aerodrome);
    await tx4.wait();
    console.log("  Fallback router set ✓");
  }

  console.log("\n========== ROUTER CONFIGURATION COMPLETE ==========\n");
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
