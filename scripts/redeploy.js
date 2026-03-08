import pkg from "hardhat";
const { ethers } = pkg;

/// @notice Redeploy all NomoLend contracts after audit fixes
/// @dev Run: npx hardhat run scripts/redeploy.js --network base
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Redeploying NomoLend with account:", deployer.address);
  console.log("Balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH\n");

  const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
  const TREASURY = deployer.address;

  // Uniswap V3 SwapRouter02 on Base
  const UNISWAP_V3_ROUTER = "0x2626664c2603336E57B271c5C0b26F421741e481";
  // Aerodrome Router on Base
  const AERODROME_ROUTER = "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43";
  // Aerodrome Pool Factory on Base
  const AERODROME_FACTORY = "0x420DD381b31aEf6683db6B902084cB0FFECe40Da";

  // 1. Deploy ProtocolConfig
  console.log("1. Deploying ProtocolConfig...");
  const ProtocolConfig = await ethers.getContractFactory("ProtocolConfig");
  const config = await ProtocolConfig.deploy(USDC_ADDRESS, TREASURY);
  await config.waitForDeployment();
  const configAddr = await config.getAddress();
  console.log("   ProtocolConfig:", configAddr);

  // 2. Deploy TokenValidator
  console.log("2. Deploying TokenValidator...");
  const TokenValidator = await ethers.getContractFactory("TokenValidator");
  const tokenValidator = await TokenValidator.deploy();
  await tokenValidator.waitForDeployment();
  const tvAddr = await tokenValidator.getAddress();
  console.log("   TokenValidator:", tvAddr);

  // 3. Deploy PriceOracle (C-02 fix: has setMaxPriceStaleness)
  console.log("3. Deploying PriceOracle (with staleness setter)...");
  const PriceOracle = await ethers.getContractFactory("PriceOracle");
  const priceOracle = await PriceOracle.deploy();
  await priceOracle.waitForDeployment();
  const poAddr = await priceOracle.getAddress();
  console.log("   PriceOracle:", poAddr);

  // 4. Deploy RiskEngine (M-01 fix: improved surge detection)
  console.log("4. Deploying RiskEngine...");
  const RiskEngine = await ethers.getContractFactory("RiskEngine");
  const riskEngine = await RiskEngine.deploy(poAddr, tvAddr);
  await riskEngine.waitForDeployment();
  const reAddr = await riskEngine.getAddress();
  console.log("   RiskEngine:", reAddr);

  // 5. Deploy CollateralManager
  console.log("5. Deploying CollateralManager...");
  const CollateralManager = await ethers.getContractFactory("CollateralManager");
  const collateralManager = await CollateralManager.deploy();
  await collateralManager.waitForDeployment();
  const cmAddr = await collateralManager.getAddress();
  console.log("   CollateralManager:", cmAddr);

  // 6. Deploy LiquidationEngine (H-05 fix: rescueTokens safeguard)
  console.log("6. Deploying LiquidationEngine...");
  const LiquidationEngine = await ethers.getContractFactory("LiquidationEngine");
  const liquidationEngine = await LiquidationEngine.deploy(USDC_ADDRESS);
  await liquidationEngine.waitForDeployment();
  const leAddr = await liquidationEngine.getAddress();
  console.log("   LiquidationEngine:", leAddr);

  // 7. Deploy OrderBook (H-02 fix: partial cancel)
  console.log("7. Deploying OrderBook...");
  const OrderBook = await ethers.getContractFactory("OrderBook");
  const orderBook = await OrderBook.deploy(USDC_ADDRESS);
  await orderBook.waitForDeployment();
  const obAddr = await orderBook.getAddress();
  console.log("   OrderBook:", obAddr);

  // 8. Deploy LoanManager (H-01: grace period, H-04: min loan)
  console.log("8. Deploying LoanManager...");
  const LoanManager = await ethers.getContractFactory("LoanManager");
  const loanManager = await LoanManager.deploy(
    configAddr, obAddr, cmAddr, reAddr, leAddr, poAddr
  );
  await loanManager.waitForDeployment();
  const lmAddr = await loanManager.getAddress();
  console.log("   LoanManager:", lmAddr);

  // 9. Deploy Swap Adapters (C-01 fix)
  console.log("9. Deploying UniswapV3Adapter...");
  const UniAdapter = await ethers.getContractFactory("UniswapV3Adapter");
  const uniAdapter = await UniAdapter.deploy(UNISWAP_V3_ROUTER);
  await uniAdapter.waitForDeployment();
  const uniAdapterAddr = await uniAdapter.getAddress();
  console.log("   UniswapV3Adapter:", uniAdapterAddr);

  console.log("10. Deploying AerodromeAdapter...");
  const AeroAdapter = await ethers.getContractFactory("AerodromeAdapter");
  const aeroAdapter = await AeroAdapter.deploy(AERODROME_ROUTER, AERODROME_FACTORY);
  await aeroAdapter.waitForDeployment();
  const aeroAdapterAddr = await aeroAdapter.getAddress();
  console.log("    AerodromeAdapter:", aeroAdapterAddr);

  // 11. Setup roles
  console.log("\n11. Setting up roles...");
  const LOAN_MANAGER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("LOAN_MANAGER_ROLE"));
  const RISK_MANAGER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("RISK_MANAGER_ROLE"));
  const LIQUIDATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("LIQUIDATOR_ROLE"));

  // Grant LoanManager roles on other contracts
  await collateralManager.grantRole(LOAN_MANAGER_ROLE, lmAddr);
  console.log("    CollateralManager -> LoanManager: LOAN_MANAGER_ROLE");

  await orderBook.grantRole(LOAN_MANAGER_ROLE, lmAddr);
  console.log("    OrderBook -> LoanManager: LOAN_MANAGER_ROLE");

  await riskEngine.grantRole(RISK_MANAGER_ROLE, lmAddr);
  console.log("    RiskEngine -> LoanManager: RISK_MANAGER_ROLE");

  await liquidationEngine.grantRole(LIQUIDATOR_ROLE, lmAddr);
  console.log("    LiquidationEngine -> LoanManager: LIQUIDATOR_ROLE");

  // M-04 fix: Grant LIQUIDATOR_ROLE on LoanManager to deployer (for keeper)
  await loanManager.grantRole(LIQUIDATOR_ROLE, deployer.address);
  console.log("    LoanManager -> Deployer: LIQUIDATOR_ROLE (for keeper)");

  // 12. Configure routers (C-01 fix: use adapters)
  console.log("\n12. Configuring routers (via adapters)...");
  await config.setPrimaryRouter(uniAdapterAddr);
  await config.setFallbackRouter(aeroAdapterAddr);
  await liquidationEngine.setPrimaryRouter(uniAdapterAddr);
  await liquidationEngine.setFallbackRouter(aeroAdapterAddr);
  console.log("    Routers configured with adapters");

  // Summary
  console.log("\n========== REDEPLOYMENT COMPLETE ==========");
  console.log("ProtocolConfig:     ", configAddr);
  console.log("TokenValidator:     ", tvAddr);
  console.log("PriceOracle:        ", poAddr);
  console.log("RiskEngine:         ", reAddr);
  console.log("CollateralManager:  ", cmAddr);
  console.log("LiquidationEngine:  ", leAddr);
  console.log("OrderBook:          ", obAddr);
  console.log("LoanManager:        ", lmAddr);
  console.log("UniswapV3Adapter:   ", uniAdapterAddr);
  console.log("AerodromeAdapter:   ", aeroAdapterAddr);
  console.log("===========================================");
  console.log("\nAudit fixes applied:");
  console.log("  C-01: Swap adapters wrapping real DEX routers");
  console.log("  C-02: PriceOracle with setMaxPriceStaleness (default 25h)");
  console.log("  H-01: 4h grace period for loan repayment");
  console.log("  H-02: Partial borrow request cancellation");
  console.log("  H-03: getValueInUsdc no longer reverts on divergence");
  console.log("  H-04: Minimum loan amount 10 USDC");
  console.log("  H-05: rescueTokens cannot drain USDC");
  console.log("  M-01: Improved surge detection (carry-over window)");
  console.log("  M-04: LIQUIDATOR_ROLE granted to deployer for keeper");
  console.log("  L-01: Removed dead code _hasFunction");
  console.log("  L-02: Removed unused EXPIRED enum");
  console.log("  L-03: deactivateToken emits event");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
