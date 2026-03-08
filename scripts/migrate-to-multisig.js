/// @notice Complete migration: verify multisig, grant bot roles, revoke deployer
///
/// This script performs the FULL migration in 3 phases:
///   Phase 1: Verify current role state across all contracts
///   Phase 2: Grant bot wallet roles (PRICE_UPDATER + LIQUIDATOR)
///   Phase 3: Grant multisig all admin roles + revoke deployer
///
/// Usage:
///   SAFE_ADDRESS=0x... BOT_ADDRESS=0x... node scripts/migrate-to-multisig.js
///   SAFE_ADDRESS=0x... BOT_ADDRESS=0x... node scripts/migrate-to-multisig.js --execute
///
/// Without --execute, runs in DRY RUN mode (read-only audit)

import { ethers } from "ethers";
import "dotenv/config";
import {
  CONTRACTS, getSigner,
  ProtocolConfigABI, TokenValidatorABI, PriceOracleABI,
  RiskEngineABI, CollateralManagerABI, LiquidationEngineABI,
  OrderBookABI, LoanManagerABI,
} from "./shared.js";

const ReserveFundABI = [
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
  "function GOVERNANCE_ROLE() view returns (bytes32)",
  "function grantRole(bytes32 role, address account) external",
  "function renounceRole(bytes32 role, address account) external",
];

const RiskGuardianABI = [
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
  "function RISK_GUARDIAN_ROLE() view returns (bytes32)",
  "function grantRole(bytes32 role, address account) external",
  "function renounceRole(bytes32 role, address account) external",
];

// All contracts and their manageable roles
const ALL_CONTRACTS = [
  { name: "ProtocolConfig",    address: CONTRACTS.ProtocolConfig,    abi: ProtocolConfigABI,    adminRoles: ["DEFAULT_ADMIN_ROLE", "ADMIN_ROLE", "RISK_MANAGER_ROLE"], botRoles: [] },
  { name: "TokenValidator",    address: CONTRACTS.TokenValidator,    abi: TokenValidatorABI,    adminRoles: ["DEFAULT_ADMIN_ROLE", "RISK_MANAGER_ROLE"], botRoles: [] },
  { name: "PriceOracle",       address: CONTRACTS.PriceOracle,       abi: PriceOracleABI,       adminRoles: ["DEFAULT_ADMIN_ROLE", "ADMIN_ROLE"], botRoles: ["PRICE_UPDATER_ROLE"] },
  { name: "RiskEngine",        address: CONTRACTS.RiskEngine,        abi: RiskEngineABI,        adminRoles: ["DEFAULT_ADMIN_ROLE", "RISK_MANAGER_ROLE"], botRoles: [] },
  { name: "CollateralManager", address: CONTRACTS.CollateralManager, abi: CollateralManagerABI, adminRoles: ["DEFAULT_ADMIN_ROLE"], botRoles: [] },
  { name: "LiquidationEngine", address: CONTRACTS.LiquidationEngine, abi: LiquidationEngineABI, adminRoles: ["DEFAULT_ADMIN_ROLE", "ADMIN_ROLE"], botRoles: [] },
  { name: "OrderBook",         address: CONTRACTS.OrderBook,         abi: OrderBookABI,         adminRoles: ["DEFAULT_ADMIN_ROLE"], botRoles: [] },
  { name: "LoanManager",       address: CONTRACTS.LoanManager,       abi: LoanManagerABI,       adminRoles: ["DEFAULT_ADMIN_ROLE", "ADMIN_ROLE"], botRoles: ["LIQUIDATOR_ROLE"] },
  { name: "ReserveFund",       address: CONTRACTS.ReserveFund,       abi: ReserveFundABI,       adminRoles: ["DEFAULT_ADMIN_ROLE", "GOVERNANCE_ROLE"], botRoles: [] },
  { name: "RiskGuardian",      address: CONTRACTS.RiskGuardian,      abi: RiskGuardianABI,      adminRoles: ["DEFAULT_ADMIN_ROLE", "RISK_GUARDIAN_ROLE"], botRoles: [] },
];

async function main() {
  const safeAddress = process.env.SAFE_ADDRESS;
  const botAddress = process.env.BOT_ADDRESS;
  const execute = process.argv.includes("--execute");

  if (!safeAddress || !ethers.isAddress(safeAddress)) {
    console.error("Error: Set SAFE_ADDRESS env var to a valid Gnosis Safe address");
    process.exit(1);
  }

  const signer = getSigner();
  const deployer = signer.address;

  console.log(`\n${"═".repeat(64)}`);
  console.log("  NomoLend — Complete Migration to Multisig");
  console.log(`${"═".repeat(64)}`);
  console.log(`  Deployer:     ${deployer}`);
  console.log(`  Safe:         ${safeAddress}`);
  console.log(`  Bot wallet:   ${botAddress || "(not set — skipping bot role grants)"}`);
  console.log(`  Mode:         ${execute ? "🔴 EXECUTE (real transactions)" : "🟢 DRY RUN (read-only audit)"}`);
  console.log(`${"═".repeat(64)}\n`);

  if (execute) {
    console.log("  ⚠️  You have 10 seconds to cancel (Ctrl+C)...\n");
    await new Promise(r => setTimeout(r, 10_000));
  }

  const summary = { granted: [], revoked: [], botGrants: [], skipped: [], errors: [] };

  // ═══════════════════════════════════════════════════════════
  //  PHASE 1: AUDIT — Check all current roles
  // ═══════════════════════════════════════════════════════════
  console.log(`${"─".repeat(64)}`);
  console.log("  PHASE 1: Role Audit");
  console.log(`${"─".repeat(64)}\n`);

  for (const def of ALL_CONTRACTS) {
    const contract = new ethers.Contract(def.address, def.abi, signer);
    console.log(`  ${def.name} (${def.address})`);

    const allRoles = [...def.adminRoles, ...def.botRoles];
    for (const roleName of allRoles) {
      try {
        const roleHash = await contract[roleName]();
        const deployerHas = await contract.hasRole(roleHash, deployer);
        const safeHas = await contract.hasRole(roleHash, safeAddress);
        const botHas = botAddress ? await contract.hasRole(roleHash, botAddress) : null;

        const dIcon = deployerHas ? "✓" : "✗";
        const sIcon = safeHas ? "✓" : "✗";
        const bIcon = botHas === null ? "-" : botHas ? "✓" : "✗";
        console.log(`    ${roleName}: deployer=${dIcon}  safe=${sIcon}  bot=${bIcon}`);
      } catch (err) {
        console.log(`    ${roleName}: ERROR — ${err.message?.slice(0, 60)}`);
      }
    }
    console.log();
  }

  if (!execute) {
    console.log(`${"═".repeat(64)}`);
    console.log("  DRY RUN complete. Run with --execute to apply changes.");
    console.log(`${"═".repeat(64)}\n`);
    return;
  }

  // ═══════════════════════════════════════════════════════════
  //  PHASE 2: GRANT BOT ROLES
  // ═══════════════════════════════════════════════════════════
  if (botAddress && ethers.isAddress(botAddress)) {
    console.log(`${"─".repeat(64)}`);
    console.log("  PHASE 2: Grant Bot Wallet Roles");
    console.log(`${"─".repeat(64)}\n`);

    for (const def of ALL_CONTRACTS) {
      if (def.botRoles.length === 0) continue;

      const contract = new ethers.Contract(def.address, def.abi, signer);
      for (const roleName of def.botRoles) {
        try {
          const roleHash = await contract[roleName]();
          const botHas = await contract.hasRole(roleHash, botAddress);

          if (botHas) {
            console.log(`  ${def.name}.${roleName}: bot already has it ✓`);
            summary.skipped.push(`${def.name}.${roleName} (bot)`);
            continue;
          }

          console.log(`  ${def.name}.${roleName}: granting to bot...`);
          const tx = await contract.grantRole(roleHash, botAddress);
          console.log(`    tx: ${tx.hash}`);
          await tx.wait();
          console.log(`    ✓ Granted`);
          summary.botGrants.push(`${def.name}.${roleName}`);
        } catch (err) {
          console.log(`    ✗ ERROR: ${err.message?.slice(0, 80)}`);
          summary.errors.push(`${def.name}.${roleName} (bot): ${err.message?.slice(0, 80)}`);
        }
      }
    }
    console.log();
  }

  // ═══════════════════════════════════════════════════════════
  //  PHASE 3: GRANT SAFE + REVOKE DEPLOYER
  // ═══════════════════════════════════════════════════════════
  console.log(`${"─".repeat(64)}`);
  console.log("  PHASE 3: Grant Safe & Revoke Deployer");
  console.log(`${"─".repeat(64)}\n`);

  for (const def of ALL_CONTRACTS) {
    const contract = new ethers.Contract(def.address, def.abi, signer);
    console.log(`  --- ${def.name} ---`);

    for (const roleName of def.adminRoles) {
      try {
        const roleHash = await contract[roleName]();

        // Step A: Grant to Safe
        const safeHas = await contract.hasRole(roleHash, safeAddress);
        if (safeHas) {
          console.log(`    ${roleName}: safe already has it ✓`);
          summary.skipped.push(`${def.name}.${roleName} (safe grant)`);
        } else {
          console.log(`    ${roleName}: granting to safe...`);
          const tx = await contract.grantRole(roleHash, safeAddress);
          console.log(`      tx: ${tx.hash}`);
          await tx.wait();
          console.log(`      ✓ Granted to safe`);
          summary.granted.push(`${def.name}.${roleName}`);
        }

        // Step B: Verify safe has it, then revoke deployer
        const safeConfirmed = await contract.hasRole(roleHash, safeAddress);
        if (!safeConfirmed) {
          console.log(`    ⚠️  Safe doesn't have ${roleName} yet — SKIPPING revoke`);
          summary.errors.push(`${def.name}.${roleName}: safe grant failed, skip revoke`);
          continue;
        }

        const deployerHas = await contract.hasRole(roleHash, deployer);
        if (!deployerHas) {
          console.log(`    ${roleName}: deployer already lacks it ✓`);
          summary.skipped.push(`${def.name}.${roleName} (deployer revoke)`);
          continue;
        }

        console.log(`    ${roleName}: revoking from deployer...`);
        const tx2 = await contract.renounceRole(roleHash, deployer);
        console.log(`      tx: ${tx2.hash}`);
        await tx2.wait();
        console.log(`      ✓ Revoked from deployer`);
        summary.revoked.push(`${def.name}.${roleName}`);
      } catch (err) {
        console.log(`    ✗ ERROR on ${roleName}: ${err.message?.slice(0, 80)}`);
        summary.errors.push(`${def.name}.${roleName}: ${err.message?.slice(0, 80)}`);
      }
    }
    console.log();
  }

  // ═══════════════════════════════════════════════════════════
  //  PHASE 4: POST-MIGRATION VERIFICATION
  // ═══════════════════════════════════════════════════════════
  console.log(`${"─".repeat(64)}`);
  console.log("  PHASE 4: Post-Migration Verification");
  console.log(`${"─".repeat(64)}\n`);

  let allClear = true;
  for (const def of ALL_CONTRACTS) {
    const contract = new ethers.Contract(def.address, def.abi, signer);
    for (const roleName of def.adminRoles) {
      try {
        const roleHash = await contract[roleName]();
        const deployerStillHas = await contract.hasRole(roleHash, deployer);
        if (deployerStillHas) {
          console.log(`  ⚠️  ${def.name}.${roleName}: deployer STILL has role!`);
          allClear = false;
        }
      } catch {}
    }
  }

  if (allClear) {
    console.log("  ✓ All admin roles revoked from deployer");
    console.log("  ✓ Deployer wallet is now a regular EOA (no protocol powers)");
  }

  // ═══════════════════════════════════════════════════════════
  //  SUMMARY
  // ═══════════════════════════════════════════════════════════
  console.log(`\n${"═".repeat(64)}`);
  console.log("  MIGRATION SUMMARY");
  console.log(`${"═".repeat(64)}`);
  console.log(`  Roles granted to Safe:       ${summary.granted.length}`);
  summary.granted.forEach(r => console.log(`    + ${r}`));
  console.log(`  Roles granted to Bot:        ${summary.botGrants.length}`);
  summary.botGrants.forEach(r => console.log(`    + ${r}`));
  console.log(`  Roles revoked from Deployer: ${summary.revoked.length}`);
  summary.revoked.forEach(r => console.log(`    - ${r}`));
  console.log(`  Skipped (already done):      ${summary.skipped.length}`);
  if (summary.errors.length > 0) {
    console.log(`  ⚠️  Errors:                   ${summary.errors.length}`);
    summary.errors.forEach(r => console.log(`    ! ${r}`));
  }
  console.log(`${"═".repeat(64)}`);

  if (allClear && summary.errors.length === 0) {
    console.log("\n  🔒 Migration complete. Deployer wallet has NO protocol powers.");
    console.log("  📋 Next steps:");
    console.log("     1. Update .env: set BOT_PRIVATE_KEY to the bot wallet key");
    console.log("     2. Remove DEPLOYER_PRIVATE_KEY from .env (no longer needed for bots)");
    console.log("     3. Start bots with PM2: pm2 start bots/ecosystem.config.cjs");
    console.log("     4. Test admin actions from Gnosis Safe\n");
  }
}

main().catch(err => {
  console.error("Fatal:", err.message || err);
  process.exit(1);
});
