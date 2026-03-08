import pkg from "hardhat";
const { ethers } = pkg;

async function main() {
  const SAFE = "0x362D5267A61f65cb4901B163B5D94adbf147DB87";
  const LE = "0x6e892AEadda28E630bbe84e469fdA25f1B1B4820";
  const TV = "0xe0CA16261405CA12F156E2F3A0B309d9587B9e4D";
  const PO = "0xc8Fb5BCaC3501E060e6AFb89cd0723BCC98f1e08";

  const le = await ethers.getContractAt("LiquidationEngine", LE);
  const tv = await ethers.getContractAt("TokenValidator", TV);
  const po = await ethers.getContractAt("PriceOracle", PO);

  const ADMIN = ethers.keccak256(ethers.toUtf8Bytes("ADMIN_ROLE"));
  const RISK_MGR = ethers.keccak256(ethers.toUtf8Bytes("RISK_MANAGER_ROLE"));
  const DEFAULT_ADMIN = "0x0000000000000000000000000000000000000000000000000000000000000000";
  const PRICE_UPDATER = ethers.keccak256(ethers.toUtf8Bytes("PRICE_UPDATER_ROLE"));

  console.log("Safe:", SAFE);
  console.log("\nLiquidationEngine:");
  console.log("  ADMIN_ROLE:", await le.hasRole(ADMIN, SAFE));
  console.log("  DEFAULT_ADMIN:", await le.hasRole(DEFAULT_ADMIN, SAFE));

  console.log("\nTokenValidator:");
  console.log("  RISK_MANAGER_ROLE:", await tv.hasRole(RISK_MGR, SAFE));
  console.log("  DEFAULT_ADMIN:", await tv.hasRole(DEFAULT_ADMIN, SAFE));

  console.log("\nPriceOracle:");
  console.log("  ADMIN_ROLE:", await po.hasRole(ADMIN, SAFE));
  console.log("  DEFAULT_ADMIN:", await po.hasRole(DEFAULT_ADMIN, SAFE));
  console.log("  PRICE_UPDATER:", await po.hasRole(PRICE_UPDATER, SAFE));
}
main();
