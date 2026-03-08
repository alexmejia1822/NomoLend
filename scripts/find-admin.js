import pkg from "hardhat";
const { ethers } = pkg;

async function main() {
  const LE = "0x6e892AEadda28E630bbe84e469fdA25f1B1B4820";
  const RG = "0xb9b90eE151D53327c1C42a268Eb974A08f1E07Ef";
  const LM = "0x356e137F8F93716e1d92F66F9e2d4866C586d9cf";

  const le = await ethers.getContractAt("LiquidationEngine", LE);

  const ADMIN = ethers.keccak256(ethers.toUtf8Bytes("ADMIN_ROLE"));
  const DEFAULT_ADMIN = "0x0000000000000000000000000000000000000000000000000000000000000000";

  console.log("LiquidationEngine ADMIN_ROLE:");
  console.log("  RiskGuardian:", await le.hasRole(ADMIN, RG));
  console.log("  LoanManager:", await le.hasRole(ADMIN, LM));

  console.log("LiquidationEngine DEFAULT_ADMIN:");
  console.log("  RiskGuardian:", await le.hasRole(DEFAULT_ADMIN, RG));
  console.log("  LoanManager:", await le.hasRole(DEFAULT_ADMIN, LM));

  // Check TokenValidator and PriceOracle too
  const TV = "0xe0CA16261405CA12F156E2F3A0B309d9587B9e4D";
  const PO = "0xc8Fb5BCaC3501E060e6AFb89cd0723BCC98f1e08";
  const tv = await ethers.getContractAt("TokenValidator", TV);
  const po = await ethers.getContractAt("PriceOracle", PO);
  const RISK_MGR = ethers.keccak256(ethers.toUtf8Bytes("RISK_MANAGER_ROLE"));

  console.log("\nTokenValidator RISK_MANAGER_ROLE:");
  console.log("  RiskGuardian:", await tv.hasRole(RISK_MGR, RG));
  console.log("TokenValidator DEFAULT_ADMIN:");
  console.log("  RiskGuardian:", await tv.hasRole(DEFAULT_ADMIN, RG));

  console.log("\nPriceOracle ADMIN_ROLE:");
  console.log("  RiskGuardian:", await po.hasRole(ADMIN, RG));
  console.log("PriceOracle DEFAULT_ADMIN:");
  console.log("  RiskGuardian:", await po.hasRole(DEFAULT_ADMIN, RG));
}
main();
