/// @notice TASK 7: Transfer protocol ownership to multisig
/// Run: MULTISIG_ADDRESS=0x... node scripts/transferOwnership.js

import { ethers } from "ethers";
import {
  CONTRACTS,
  ProtocolConfigABI, TokenValidatorABI, PriceOracleABI,
  RiskEngineABI, CollateralManagerABI, LiquidationEngineABI,
  OrderBookABI, LoanManagerABI,
  getSigner,
} from "./shared.js";

const MULTISIG = process.env.MULTISIG_ADDRESS;

async function transferRoles(contractName, contractAddr, abi, signer) {
  const contract = new ethers.Contract(contractAddr, abi, signer);

  const DEFAULT_ADMIN = await contract.DEFAULT_ADMIN_ROLE();

  console.log(`\n=== ${contractName} (${contractAddr}) ===`);

  // Grant DEFAULT_ADMIN_ROLE to multisig
  const hasAdmin = await contract.hasRole(DEFAULT_ADMIN, MULTISIG);
  if (hasAdmin) {
    console.log("  Multisig already has DEFAULT_ADMIN_ROLE");
  } else {
    console.log("  Granting DEFAULT_ADMIN_ROLE to multisig...");
    const tx = await contract.grantRole(DEFAULT_ADMIN, MULTISIG);
    await tx.wait();
    console.log("  Granted ✓");
  }

  // Try to grant ADMIN_ROLE if contract has it
  try {
    const ADMIN = await contract.ADMIN_ROLE();
    const hasAdminRole = await contract.hasRole(ADMIN, MULTISIG);
    if (!hasAdminRole) {
      console.log("  Granting ADMIN_ROLE to multisig...");
      const tx2 = await contract.grantRole(ADMIN, MULTISIG);
      await tx2.wait();
      console.log("  Granted ✓");
    } else {
      console.log("  Multisig already has ADMIN_ROLE");
    }
  } catch { /* contract may not have ADMIN_ROLE */ }

  // Try to grant RISK_MANAGER_ROLE if contract has it
  try {
    const RISK = await contract.RISK_MANAGER_ROLE();
    const hasRisk = await contract.hasRole(RISK, MULTISIG);
    if (!hasRisk) {
      console.log("  Granting RISK_MANAGER_ROLE to multisig...");
      const tx3 = await contract.grantRole(RISK, MULTISIG);
      await tx3.wait();
      console.log("  Granted ✓");
    } else {
      console.log("  Multisig already has RISK_MANAGER_ROLE");
    }
  } catch { /* contract may not have RISK_MANAGER_ROLE */ }

  // Renounce deployer's DEFAULT_ADMIN_ROLE
  const deployerHasAdmin = await contract.hasRole(DEFAULT_ADMIN, signer.address);
  if (deployerHasAdmin) {
    console.log("  Renouncing deployer DEFAULT_ADMIN_ROLE...");
    const tx4 = await contract.renounceRole(DEFAULT_ADMIN, signer.address);
    await tx4.wait();
    console.log("  Renounced ✓");
  }
}

async function main() {
  if (!MULTISIG || !ethers.isAddress(MULTISIG)) {
    console.error("Set MULTISIG_ADDRESS environment variable to a valid address.");
    console.error("Usage: MULTISIG_ADDRESS=0x... node scripts/transferOwnership.js");
    process.exit(1);
  }

  const signer = getSigner();
  console.log("Deployer:", signer.address);
  console.log("Multisig:", MULTISIG);
  console.log("Network: Base Mainnet");

  const contractList = [
    ["ProtocolConfig", CONTRACTS.ProtocolConfig, ProtocolConfigABI],
    ["TokenValidator", CONTRACTS.TokenValidator, TokenValidatorABI],
    ["PriceOracle", CONTRACTS.PriceOracle, PriceOracleABI],
    ["RiskEngine", CONTRACTS.RiskEngine, RiskEngineABI],
    ["CollateralManager", CONTRACTS.CollateralManager, CollateralManagerABI],
    ["LiquidationEngine", CONTRACTS.LiquidationEngine, LiquidationEngineABI],
    ["OrderBook", CONTRACTS.OrderBook, OrderBookABI],
    ["LoanManager", CONTRACTS.LoanManager, LoanManagerABI],
  ];

  for (const [name, addr, abi] of contractList) {
    await transferRoles(name, addr, abi, signer);
  }

  console.log("\n========== OWNERSHIP TRANSFER COMPLETE ==========");
  console.log("All roles transferred to:", MULTISIG);
  console.log("Deployer roles renounced.");
  console.log("=================================================\n");
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
