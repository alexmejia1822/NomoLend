/// @notice Cleanup: renounce all remaining deployer roles
import { ethers } from "ethers";
import "dotenv/config";
import { CONTRACTS, getSigner, ProtocolConfigABI, PriceOracleABI, LoanManagerABI } from "./shared.js";

const ReserveFundABI = [
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
  "function GOVERNANCE_ROLE() view returns (bytes32)",
  "function renounceRole(bytes32 role, address account) external",
];
const TokenValidatorABI = [
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
  "function renounceRole(bytes32 role, address account) external",
];
const RiskGuardianABI = [
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function RISK_GUARDIAN_ROLE() view returns (bytes32)",
  "function renounceRole(bytes32 role, address account) external",
];

async function main() {
  const signer = getSigner();
  const deployer = signer.address;
  console.log("Deployer:", deployer);

  const tasks = [
    { name: "ProtocolConfig", addr: CONTRACTS.ProtocolConfig, abi: ProtocolConfigABI, role: "RISK_MANAGER_ROLE" },
    { name: "TokenValidator", addr: CONTRACTS.TokenValidator, abi: TokenValidatorABI, role: "DEFAULT_ADMIN_ROLE" },
    { name: "PriceOracle", addr: CONTRACTS.PriceOracle, abi: PriceOracleABI, role: "PRICE_UPDATER_ROLE" },
    { name: "LoanManager", addr: CONTRACTS.LoanManager, abi: LoanManagerABI, role: "LIQUIDATOR_ROLE" },
    { name: "ReserveFund", addr: CONTRACTS.ReserveFund, abi: ReserveFundABI, role: "DEFAULT_ADMIN_ROLE" },
    { name: "ReserveFund", addr: CONTRACTS.ReserveFund, abi: ReserveFundABI, role: "GOVERNANCE_ROLE" },
    { name: "RiskGuardian", addr: CONTRACTS.RiskGuardian, abi: RiskGuardianABI, role: "RISK_GUARDIAN_ROLE" },
  ];

  for (const t of tasks) {
    const contract = new ethers.Contract(t.addr, t.abi, signer);
    try {
      const roleHash = await contract[t.role]();
      const has = await contract.hasRole(roleHash, deployer);
      if (!has) {
        console.log(`  ${t.name}.${t.role}: already renounced`);
        continue;
      }
      console.log(`  ${t.name}.${t.role}: renouncing...`);
      const tx = await contract.renounceRole(roleHash, deployer);
      console.log(`    tx: ${tx.hash}`);
      await tx.wait();
      console.log(`    done`);
    } catch (err) {
      console.log(`    ERROR: ${err.reason || err.message?.slice(0, 80)}`);
    }
  }
  console.log("\nCleanup complete.");
}

main().catch(err => { console.error(err); process.exit(1); });
