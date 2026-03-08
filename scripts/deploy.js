import pkg from "hardhat";
const { ethers } = pkg;

/// @notice Deployment script for NomoLend protocol on Base
/// @dev Run: npx hardhat run scripts/deploy.js --network base
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying NomoLend with account:", deployer.address);

  // Base mainnet USDC
  const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
  const TREASURY = deployer.address; // Change to multisig in production

  // 1. Deploy ProtocolConfig
  console.log("\n1. Deploying ProtocolConfig...");
  const ProtocolConfig = await ethers.getContractFactory("ProtocolConfig");
  const config = await ProtocolConfig.deploy(USDC_ADDRESS, TREASURY);
  await config.waitForDeployment();
  console.log("   ProtocolConfig:", await config.getAddress());

  // 2. Deploy TokenValidator
  console.log("2. Deploying TokenValidator...");
  const TokenValidator = await ethers.getContractFactory("TokenValidator");
  const tokenValidator = await TokenValidator.deploy();
  await tokenValidator.waitForDeployment();
  console.log("   TokenValidator:", await tokenValidator.getAddress());

  // 3. Deploy PriceOracle
  console.log("3. Deploying PriceOracle...");
  const PriceOracle = await ethers.getContractFactory("PriceOracle");
  const priceOracle = await PriceOracle.deploy();
  await priceOracle.waitForDeployment();
  console.log("   PriceOracle:", await priceOracle.getAddress());

  // 4. Deploy RiskEngine
  console.log("4. Deploying RiskEngine...");
  const RiskEngine = await ethers.getContractFactory("RiskEngine");
  const riskEngine = await RiskEngine.deploy(
    await priceOracle.getAddress(),
    await tokenValidator.getAddress()
  );
  await riskEngine.waitForDeployment();
  console.log("   RiskEngine:", await riskEngine.getAddress());

  // 5. Deploy CollateralManager
  console.log("5. Deploying CollateralManager...");
  const CollateralManager = await ethers.getContractFactory("CollateralManager");
  const collateralManager = await CollateralManager.deploy();
  await collateralManager.waitForDeployment();
  console.log("   CollateralManager:", await collateralManager.getAddress());

  // 6. Deploy LiquidationEngine
  console.log("6. Deploying LiquidationEngine...");
  const LiquidationEngine = await ethers.getContractFactory("LiquidationEngine");
  const liquidationEngine = await LiquidationEngine.deploy(USDC_ADDRESS);
  await liquidationEngine.waitForDeployment();
  console.log("   LiquidationEngine:", await liquidationEngine.getAddress());

  // 7. Deploy OrderBook
  console.log("7. Deploying OrderBook...");
  const OrderBook = await ethers.getContractFactory("OrderBook");
  const orderBook = await OrderBook.deploy(USDC_ADDRESS);
  await orderBook.waitForDeployment();
  console.log("   OrderBook:", await orderBook.getAddress());

  // 8. Deploy LoanManager
  console.log("8. Deploying LoanManager...");
  const LoanManager = await ethers.getContractFactory("LoanManager");
  const loanManager = await LoanManager.deploy(
    await config.getAddress(),
    await orderBook.getAddress(),
    await collateralManager.getAddress(),
    await riskEngine.getAddress(),
    await liquidationEngine.getAddress(),
    await priceOracle.getAddress()
  );
  await loanManager.waitForDeployment();
  console.log("   LoanManager:", await loanManager.getAddress());

  // 9. Setup roles
  console.log("\n9. Setting up roles...");
  const LOAN_MANAGER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("LOAN_MANAGER_ROLE"));
  const RISK_MANAGER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("RISK_MANAGER_ROLE"));
  const LIQUIDATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("LIQUIDATOR_ROLE"));

  await collateralManager.grantRole(LOAN_MANAGER_ROLE, await loanManager.getAddress());
  await orderBook.grantRole(LOAN_MANAGER_ROLE, await loanManager.getAddress());
  await riskEngine.grantRole(RISK_MANAGER_ROLE, await loanManager.getAddress());
  await liquidationEngine.grantRole(LIQUIDATOR_ROLE, await loanManager.getAddress());

  console.log("   Roles configured");

  // Summary
  console.log("\n========== DEPLOYMENT COMPLETE ==========");
  console.log("Network: Base");
  console.log("ProtocolConfig:    ", await config.getAddress());
  console.log("TokenValidator:    ", await tokenValidator.getAddress());
  console.log("PriceOracle:       ", await priceOracle.getAddress());
  console.log("RiskEngine:        ", await riskEngine.getAddress());
  console.log("CollateralManager: ", await collateralManager.getAddress());
  console.log("LiquidationEngine: ", await liquidationEngine.getAddress());
  console.log("OrderBook:         ", await orderBook.getAddress());
  console.log("LoanManager:       ", await loanManager.getAddress());
  console.log("=========================================\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
