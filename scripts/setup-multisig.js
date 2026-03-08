/// @notice Transfer admin roles from deployer to a Safe multisig
/// Usage: SAFE_ADDRESS=0x... node scripts/setup-multisig.js [--revoke]
import { ethers } from "ethers";
import "dotenv/config";
import {
  CONTRACTS, getSigner,
  ProtocolConfigABI, TokenValidatorABI, PriceOracleABI,
  RiskEngineABI, CollateralManagerABI, LiquidationEngineABI,
  OrderBookABI, LoanManagerABI,
} from "./shared.js";

// Minimal ABI for ReserveFund (not exported from shared.js)
const ReserveFundABI = [
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
  "function grantRole(bytes32 role, address account) external",
  "function renounceRole(bytes32 role, address account) external",
];

// Contract definitions: name, address, ABI, and role getter names
const CONTRACT_ROLES = [
  { name: "ProtocolConfig",    address: CONTRACTS.ProtocolConfig,    abi: ProtocolConfigABI,    roles: ["DEFAULT_ADMIN_ROLE", "ADMIN_ROLE"] },
  { name: "TokenValidator",    address: CONTRACTS.TokenValidator,    abi: TokenValidatorABI,    roles: ["DEFAULT_ADMIN_ROLE", "RISK_MANAGER_ROLE"] },
  { name: "PriceOracle",       address: CONTRACTS.PriceOracle,       abi: PriceOracleABI,       roles: ["DEFAULT_ADMIN_ROLE", "ADMIN_ROLE", "PRICE_UPDATER_ROLE"] },
  { name: "RiskEngine",        address: CONTRACTS.RiskEngine,        abi: RiskEngineABI,        roles: ["DEFAULT_ADMIN_ROLE", "RISK_MANAGER_ROLE"] },
  { name: "CollateralManager", address: CONTRACTS.CollateralManager, abi: CollateralManagerABI, roles: ["DEFAULT_ADMIN_ROLE"] },
  { name: "LiquidationEngine", address: CONTRACTS.LiquidationEngine, abi: LiquidationEngineABI, roles: ["DEFAULT_ADMIN_ROLE", "ADMIN_ROLE"] },
  { name: "OrderBook",         address: CONTRACTS.OrderBook,         abi: OrderBookABI,         roles: ["DEFAULT_ADMIN_ROLE"] },
  { name: "LoanManager",       address: CONTRACTS.LoanManager,       abi: LoanManagerABI,       roles: ["DEFAULT_ADMIN_ROLE", "ADMIN_ROLE", "LIQUIDATOR_ROLE"] },
  { name: "ReserveFund",       address: CONTRACTS.ReserveFund,       abi: ReserveFundABI,       roles: ["DEFAULT_ADMIN_ROLE"] },
];

async function main() {
  const safeAddress = process.env.SAFE_ADDRESS || process.argv[2];
  const revokeFlag = process.argv.includes("--revoke");

  if (!safeAddress || !ethers.isAddress(safeAddress)) {
    console.error("Error: Provide a valid SAFE_ADDRESS via env var or command line argument.");
    console.error("Usage: SAFE_ADDRESS=0x... node scripts/setup-multisig.js [--revoke]");
    process.exit(1);
  }

  const signer = getSigner();
  const deployer = signer.address;

  console.log(`\n${"=".repeat(60)}`);
  console.log("  NomoLend — Setup Multisig Roles");
  console.log(`${"=".repeat(60)}`);
  console.log(`  Deployer:  ${deployer}`);
  console.log(`  Safe:      ${safeAddress}`);
  console.log(`  Revoke:    ${revokeFlag ? "YES (will renounce deployer roles)" : "NO (grant only)"}`);
  console.log(`${"=".repeat(60)}\n`);

  const summary = { granted: [], alreadyHad: [], revoked: [], errors: [] };

  // ── Phase 1: Verify deployer roles & grant to Safe ──
  for (const def of CONTRACT_ROLES) {
    const contract = new ethers.Contract(def.address, def.abi, signer);
    console.log(`--- ${def.name} (${def.address}) ---`);

    for (const roleName of def.roles) {
      try {
        const roleHash = await contract[roleName]();

        // Check deployer
        const deployerHas = await contract.hasRole(roleHash, deployer);
        console.log(`  ${roleName}: deployer=${deployerHas ? "YES" : "NO"}`);

        if (!deployerHas) {
          console.log(`    WARNING: Deployer does NOT hold ${roleName} — cannot grant to Safe.`);
          summary.errors.push(`${def.name}.${roleName}: deployer missing role`);
          continue;
        }

        // Check Safe
        const safeHas = await contract.hasRole(roleHash, safeAddress);
        if (safeHas) {
          console.log(`    Safe already has ${roleName} — skipping grant.`);
          summary.alreadyHad.push(`${def.name}.${roleName}`);
          continue;
        }

        // Grant to Safe
        console.log(`    Granting ${roleName} to Safe...`);
        const tx = await contract.grantRole(roleHash, safeAddress);
        console.log(`    tx: ${tx.hash}`);
        await tx.wait();
        console.log(`    Granted.`);
        summary.granted.push(`${def.name}.${roleName}`);
      } catch (err) {
        console.log(`    ERROR on ${roleName}: ${err.message || err}`);
        summary.errors.push(`${def.name}.${roleName}: ${err.message || err}`);
      }
    }
    console.log();
  }

  // ── Phase 2: Revoke deployer roles (if --revoke) ──
  if (revokeFlag) {
    console.log(`${"=".repeat(60)}`);
    console.log("  Phase 2: Renouncing deployer roles");
    console.log(`${"=".repeat(60)}\n`);

    for (const def of CONTRACT_ROLES) {
      const contract = new ethers.Contract(def.address, def.abi, signer);
      console.log(`--- ${def.name} ---`);

      for (const roleName of def.roles) {
        try {
          const roleHash = await contract[roleName]();

          // Verify Safe has the role before renouncing
          const safeHas = await contract.hasRole(roleHash, safeAddress);
          if (!safeHas) {
            console.log(`    SKIPPING renounce of ${roleName} — Safe does NOT hold it yet.`);
            continue;
          }

          const deployerHas = await contract.hasRole(roleHash, deployer);
          if (!deployerHas) {
            console.log(`    Deployer already lacks ${roleName} — nothing to renounce.`);
            continue;
          }

          console.log(`    Renouncing ${roleName} from deployer...`);
          const tx = await contract.renounceRole(roleHash, deployer);
          console.log(`    tx: ${tx.hash}`);
          await tx.wait();
          console.log(`    Renounced.`);
          summary.revoked.push(`${def.name}.${roleName}`);
        } catch (err) {
          console.log(`    ERROR renouncing ${roleName}: ${err.message || err}`);
          summary.errors.push(`${def.name}.${roleName} (renounce): ${err.message || err}`);
        }
      }
      console.log();
    }
  }

  // ── Summary ──
  console.log(`\n${"=".repeat(60)}`);
  console.log("  SUMMARY");
  console.log(`${"=".repeat(60)}`);
  console.log(`  Roles granted to Safe:    ${summary.granted.length}`);
  summary.granted.forEach((r) => console.log(`    + ${r}`));
  console.log(`  Roles Safe already had:   ${summary.alreadyHad.length}`);
  summary.alreadyHad.forEach((r) => console.log(`    = ${r}`));
  if (revokeFlag) {
    console.log(`  Roles revoked from deployer: ${summary.revoked.length}`);
    summary.revoked.forEach((r) => console.log(`    - ${r}`));
  }
  if (summary.errors.length > 0) {
    console.log(`  Errors:                   ${summary.errors.length}`);
    summary.errors.forEach((r) => console.log(`    ! ${r}`));
  }
  console.log(`${"=".repeat(60)}\n`);
}

main().catch((err) => {
  console.error("Fatal error:", err.message || err);
  process.exit(1);
});
