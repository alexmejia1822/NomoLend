import pkg from "hardhat";
const { ethers } = pkg;

/// @notice Full redeploy — Round 6: Audit fix deployment
/// @dev Run: npx hardhat run scripts/redeployAll.js --network base
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Redeploying NomoLend (Round 6 — Audit Fixes) with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH\n");

  const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
  const TREASURY = deployer.address;
  const UNISWAP_V3_ROUTER = "0x2626664c2603336E57B271c5C0b26F421741e481";
  const AERODROME_ROUTER = "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43";
  const AERODROME_FACTORY = "0x420DD381b31aEf6683db6B902084cB0FFECe40Da";

  // 1. ProtocolConfig
  console.log("1. Deploying ProtocolConfig...");
  const ProtocolConfig = await ethers.getContractFactory("ProtocolConfig");
  const config = await ProtocolConfig.deploy(USDC_ADDRESS, TREASURY);
  await config.waitForDeployment();
  const configAddr = await config.getAddress();
  console.log("   ProtocolConfig:", configAddr);

  // 2. TokenValidator
  console.log("2. Deploying TokenValidator...");
  const TokenValidator = await ethers.getContractFactory("TokenValidator");
  const tokenValidator = await TokenValidator.deploy();
  await tokenValidator.waitForDeployment();
  const tvAddr = await tokenValidator.getAddress();
  console.log("   TokenValidator:", tvAddr);

  // 3. PriceOracle
  console.log("3. Deploying PriceOracle...");
  const PriceOracle = await ethers.getContractFactory("PriceOracle");
  const priceOracle = await PriceOracle.deploy();
  await priceOracle.waitForDeployment();
  const poAddr = await priceOracle.getAddress();
  console.log("   PriceOracle:", poAddr);

  // 4. RiskEngine (circuit breaker, liquidity, dashboard)
  console.log("4. Deploying RiskEngine...");
  const RiskEngine = await ethers.getContractFactory("RiskEngine");
  const riskEngine = await RiskEngine.deploy(poAddr, tvAddr);
  await riskEngine.waitForDeployment();
  const reAddr = await riskEngine.getAddress();
  console.log("   RiskEngine:", reAddr);

  // 5. CollateralManager
  console.log("5. Deploying CollateralManager...");
  const CollateralManager = await ethers.getContractFactory("CollateralManager");
  const collateralManager = await CollateralManager.deploy();
  await collateralManager.waitForDeployment();
  const cmAddr = await collateralManager.getAddress();
  console.log("   CollateralManager:", cmAddr);

  // 6. LiquidationEngine
  console.log("6. Deploying LiquidationEngine...");
  const LiquidationEngine = await ethers.getContractFactory("LiquidationEngine");
  const liquidationEngine = await LiquidationEngine.deploy(USDC_ADDRESS);
  await liquidationEngine.waitForDeployment();
  const leAddr = await liquidationEngine.getAddress();
  console.log("   LiquidationEngine:", leAddr);

  // 7. OrderBook
  console.log("7. Deploying OrderBook...");
  const OrderBook = await ethers.getContractFactory("OrderBook");
  const orderBook = await OrderBook.deploy(USDC_ADDRESS);
  await orderBook.waitForDeployment();
  const obAddr = await orderBook.getAddress();
  console.log("   OrderBook:", obAddr);

  // 8. LoanManager (circuit breaker + reserve fund)
  console.log("8. Deploying LoanManager...");
  const LoanManager = await ethers.getContractFactory("LoanManager");
  const loanManager = await LoanManager.deploy(configAddr, obAddr, cmAddr, reAddr, leAddr, poAddr);
  await loanManager.waitForDeployment();
  const lmAddr = await loanManager.getAddress();
  console.log("   LoanManager:", lmAddr);

  // 9. UniswapV3Adapter
  console.log("9. Deploying UniswapV3Adapter...");
  const UniAdapter = await ethers.getContractFactory("UniswapV3Adapter");
  const uniAdapter = await UniAdapter.deploy(UNISWAP_V3_ROUTER);
  await uniAdapter.waitForDeployment();
  const uniAddr = await uniAdapter.getAddress();
  console.log("   UniswapV3Adapter:", uniAddr);

  // 10. AerodromeAdapter
  console.log("10. Deploying AerodromeAdapter...");
  const AeroAdapter = await ethers.getContractFactory("AerodromeAdapter");
  const aeroAdapter = await AeroAdapter.deploy(AERODROME_ROUTER, AERODROME_FACTORY);
  await aeroAdapter.waitForDeployment();
  const aeroAddr = await aeroAdapter.getAddress();
  console.log("    AerodromeAdapter:", aeroAddr);

  // 11. RiskGuardian (NEW)
  console.log("11. Deploying RiskGuardian...");
  const RiskGuardian = await ethers.getContractFactory("RiskGuardian");
  const guardian = await RiskGuardian.deploy(reAddr);
  await guardian.waitForDeployment();
  const guardianAddr = await guardian.getAddress();
  console.log("    RiskGuardian:", guardianAddr);

  // 12. ReserveFund (NEW)
  console.log("12. Deploying ReserveFund...");
  const ReserveFund = await ethers.getContractFactory("ReserveFund");
  const reserveFund = await ReserveFund.deploy(USDC_ADDRESS);
  await reserveFund.waitForDeployment();
  const rfAddr = await reserveFund.getAddress();
  console.log("    ReserveFund:", rfAddr);

  // 13. Setup roles
  console.log("\n13. Setting up roles...");
  const LOAN_MANAGER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("LOAN_MANAGER_ROLE"));
  const RISK_MANAGER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("RISK_MANAGER_ROLE"));
  const LIQUIDATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("LIQUIDATOR_ROLE"));

  await collateralManager.grantRole(LOAN_MANAGER_ROLE, lmAddr);
  console.log("    CollateralManager -> LoanManager: LOAN_MANAGER_ROLE");

  await orderBook.grantRole(LOAN_MANAGER_ROLE, lmAddr);
  console.log("    OrderBook -> LoanManager: LOAN_MANAGER_ROLE");

  await riskEngine.grantRole(RISK_MANAGER_ROLE, lmAddr);
  console.log("    RiskEngine -> LoanManager: RISK_MANAGER_ROLE");

  // Grant RiskGuardian the RISK_MANAGER_ROLE on RiskEngine
  await riskEngine.grantRole(RISK_MANAGER_ROLE, guardianAddr);
  console.log("    RiskEngine -> RiskGuardian: RISK_MANAGER_ROLE");

  await liquidationEngine.grantRole(LIQUIDATOR_ROLE, lmAddr);
  console.log("    LiquidationEngine -> LoanManager: LIQUIDATOR_ROLE");

  await loanManager.grantRole(LIQUIDATOR_ROLE, deployer.address);
  console.log("    LoanManager -> Deployer: LIQUIDATOR_ROLE (for keeper)");

  // 14. Configure routers
  console.log("\n14. Configuring routers...");
  await config.initializeRouters(uniAddr, aeroAddr);
  await liquidationEngine.setPrimaryRouter(uniAddr);
  await liquidationEngine.setFallbackRouter(aeroAddr);
  console.log("    Routers configured");

  // 15. Configure reserve fund
  console.log("\n15. Configuring reserve fund...");
  const ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ADMIN_ROLE"));
  await loanManager.setReserveFund(rfAddr);
  console.log("    LoanManager -> ReserveFund:", rfAddr);
  console.log("    Reserve fee: 20% of platform fee (2% of interest)");

  // Summary
  console.log("\n========== REDEPLOYMENT COMPLETE (Round 6) ==========");
  console.log("ProtocolConfig:     ", configAddr);
  console.log("TokenValidator:     ", tvAddr);
  console.log("PriceOracle:        ", poAddr);
  console.log("RiskEngine:         ", reAddr);
  console.log("CollateralManager:  ", cmAddr);
  console.log("LiquidationEngine:  ", leAddr);
  console.log("OrderBook:          ", obAddr);
  console.log("LoanManager:        ", lmAddr);
  console.log("UniswapV3Adapter:   ", uniAddr);
  console.log("AerodromeAdapter:   ", aeroAddr);
  console.log("RiskGuardian:       ", guardianAddr);
  console.log("ReserveFund:        ", rfAddr);
  console.log("=====================================================");
  console.log("\nRound 6 audit fixes:");
  console.log("  H-5-01: TWAP update cooldown (5 min)");
  console.log("  M-5-01: Ghost loan read protection");
  console.log("  M-5-02: Graceful price degradation on deactivated feeds");
  console.log("  M-5-03: Minimum LTV floor (10%) in RiskGuardian");
  console.log("  M-5-04: DEX liquidity staleness check (6h)");
  console.log("  M-5-05: Insufficient fee event in LiquidationEngine");
  console.log("  M-5-06: Price confidence check in getValueInUsdc");
  console.log("  L-5-03: LendingOrderFilled event");
  console.log("  L-5-04: TokensRescued events");
  console.log("  L-5-05: RouterChangeCancelled events");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
