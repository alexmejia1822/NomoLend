import pkg from "hardhat";
const { ethers } = pkg;

/// @notice Deploy AerodromeMultihopAdapter, register new tokens, and configure routes
/// @dev Run: npx hardhat run scripts/deploy-multihop-adapter.js --network base
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // Base mainnet addresses
  const AERODROME_ROUTER = "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43";
  const AERODROME_FACTORY = "0x420DD381b31aEf6683db6B902084cB0FFECe40Da";
  const WETH = "0x4200000000000000000000000000000000000006";
  const LIQUIDATION_ENGINE = "0x6e892AEadda28E630bbe84e469fdA25f1B1B4820";
  const TOKEN_VALIDATOR = "0xe0CA16261405CA12F156E2F3A0B309d9587B9e4D";
  const PRICE_ORACLE = "0xc8Fb5BCaC3501E060e6AFb89cd0723BCC98f1e08";

  // ============================================================
  // 1. Deploy AerodromeMultihopAdapter
  // ============================================================
  console.log("\n1. Deploying AerodromeMultihopAdapter...");
  const Adapter = await ethers.getContractFactory("AerodromeMultihopAdapter");
  const adapter = await Adapter.deploy(AERODROME_ROUTER, AERODROME_FACTORY, WETH);
  await adapter.waitForDeployment();
  const adapterAddress = await adapter.getAddress();
  console.log("   AerodromeMultihopAdapter:", adapterAddress);

  // ============================================================
  // 2. Configure routes — existing tokens
  // ============================================================
  console.log("\n2. Configuring routes for existing tokens...");

  // Stable pools (single-hop)
  await adapter.setStablePool("0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", true); // DAI
  console.log("   DAI: single-hop (stable)");
  await adapter.setStablePool("0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA", true); // USDbC
  console.log("   USDbC: single-hop (stable)");

  // Multi-hop via WETH (existing tokens)
  await adapter.setMultihopRoute("0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22", true, false, false); // cbETH
  console.log("   cbETH: multi-hop via WETH");
  await adapter.setMultihopRoute("0x88Fb150BDc53A65fe94Dea0c9BA0a6dAf8C6e196", true, false, false); // LINK
  console.log("   LINK: multi-hop via WETH");
  await adapter.setMultihopRoute("0xc3De830EA07524a0761646a6a4e4be0e114a3C83", true, false, false); // UNI
  console.log("   UNI: multi-hop via WETH");
  await adapter.setMultihopRoute("0xD262A4c7108C8139b2B189758e8D17c3DFC91a38", true, false, false); // CYPR
  console.log("   CYPR: multi-hop via WETH");

  // WETH -> USDC: single-hop volatile (default, no config needed)
  console.log("   WETH: single-hop (volatile, default)");

  // ============================================================
  // 3. Configure routes — new tokens
  // ============================================================
  console.log("\n3. Configuring routes for new tokens...");

  // Direct USDC pools (single-hop volatile — default, no config needed)
  // VFY, ZRO, TIG, BID, MAMO, GIZA, GHST, AVAIL, KTA, BRETT, VIRTUAL
  console.log("   VFY: single-hop (volatile, default)");
  console.log("   ZRO: single-hop (volatile, default)");
  console.log("   TIG: single-hop (volatile, default)");
  console.log("   BID: single-hop (volatile, default)");
  console.log("   MAMO: single-hop (volatile, default)");
  console.log("   GIZA: single-hop (volatile, default)");
  console.log("   GHST: single-hop (volatile, default)");
  console.log("   AVAIL: single-hop (volatile, default)");
  console.log("   KTA: single-hop (volatile, default)");
  console.log("   BRETT: single-hop (volatile, default)");
  console.log("   VIRTUAL: single-hop (volatile, default)");

  // Multi-hop via WETH (new tokens without direct USDC pool)
  await adapter.setMultihopRoute("0x6b2504a03ca4d43d0d73776f6ad46dab2f2a4cfd", true, false, false); // REI
  console.log("   REI: multi-hop via WETH");
  await adapter.setMultihopRoute("0x696f9436b67233384889472cd7cd58a6fb5df4f1", true, false, false); // AVNT
  console.log("   AVNT: multi-hop via WETH");
  await adapter.setMultihopRoute("0x2b11834ed1feaed4b4b3a86a6f571315e25a884d", true, false, false); // MOCA
  console.log("   MOCA: multi-hop via WETH");

  // ============================================================
  // 4. Set as primary router on LiquidationEngine
  // ============================================================
  console.log("\n4. Setting as primary router on LiquidationEngine...");
  const liquidationEngine = await ethers.getContractAt("LiquidationEngine", LIQUIDATION_ENGINE);
  await liquidationEngine.setPrimaryRouter(adapterAddress);
  console.log("   Primary router updated to:", adapterAddress);

  // ============================================================
  // 5. Whitelist new tokens in TokenValidator
  // ============================================================
  console.log("\n5. Whitelisting new tokens in TokenValidator...");
  const tokenValidator = await ethers.getContractAt("TokenValidator", TOKEN_VALIDATOR);

  const newTokens = [
    { symbol: "REI",     address: "0x6b2504a03ca4d43d0d73776f6ad46dab2f2a4cfd" },
    { symbol: "AVNT",    address: "0x696f9436b67233384889472cd7cd58a6fb5df4f1" },
    { symbol: "GHST",    address: "0xcd2f22236dd9dfe2356d7c543161d4d260fd9bcb" },
    { symbol: "VFY",     address: "0xa749de6c28262b7ffbc5de27dc845dd7ecd2b358" },
    { symbol: "ZRO",     address: "0x6985884c4392d348587b19cb9eaaf157f13271cd" },
    { symbol: "TIG",     address: "0x0c03ce270b4826ec62e7dd007f0b716068639f7b" },
    { symbol: "BID",     address: "0xa1832f7f4e534ae557f9b5ab76de54b1873e498b" },
    { symbol: "MAMO",    address: "0x7300b37dfdfab110d83290a29dfb31b1740219fe" },
    { symbol: "GIZA",    address: "0x590830dfdf9a3f68afcdde2694773debdf267774" },
    { symbol: "MOCA",    address: "0x2b11834ed1feaed4b4b3a86a6f571315e25a884d" },
    { symbol: "AVAIL",   address: "0xd89d90d26b48940fa8f58385fe84625d468e057a" },
    { symbol: "KTA",     address: "0xc0634090f2fe6c6d75e61be2b949464abb498973" },
    { symbol: "BRETT",   address: "0x532f27101965dd16442e59d40670faf5ebb142e4" },
    { symbol: "VIRTUAL", address: "0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b" },
  ];

  for (const t of newTokens) {
    await tokenValidator.whitelistToken(t.address);
    console.log(`   ${t.symbol} whitelisted`);
  }

  // ============================================================
  // 6. Register price feeds in PriceOracle (TWAP-only, no Chainlink for these)
  // ============================================================
  console.log("\n6. Registering price feeds in PriceOracle...");
  const priceOracle = await ethers.getContractAt("PriceOracle", PRICE_ORACLE);
  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

  const tokenFeeds = [
    { symbol: "REI",     address: "0x6b2504a03ca4d43d0d73776f6ad46dab2f2a4cfd", decimals: 18 },
    { symbol: "AVNT",    address: "0x696f9436b67233384889472cd7cd58a6fb5df4f1", decimals: 18 },
    { symbol: "GHST",    address: "0xcd2f22236dd9dfe2356d7c543161d4d260fd9bcb", decimals: 18 },
    { symbol: "VFY",     address: "0xa749de6c28262b7ffbc5de27dc845dd7ecd2b358", decimals: 18 },
    { symbol: "ZRO",     address: "0x6985884c4392d348587b19cb9eaaf157f13271cd", decimals: 18 },
    { symbol: "TIG",     address: "0x0c03ce270b4826ec62e7dd007f0b716068639f7b", decimals: 18 },
    { symbol: "BID",     address: "0xa1832f7f4e534ae557f9b5ab76de54b1873e498b", decimals: 18 },
    { symbol: "MAMO",    address: "0x7300b37dfdfab110d83290a29dfb31b1740219fe", decimals: 18 },
    { symbol: "GIZA",    address: "0x590830dfdf9a3f68afcdde2694773debdf267774", decimals: 18 },
    { symbol: "MOCA",    address: "0x2b11834ed1feaed4b4b3a86a6f571315e25a884d", decimals: 18 },
    { symbol: "AVAIL",   address: "0xd89d90d26b48940fa8f58385fe84625d468e057a", decimals: 18 },
    { symbol: "KTA",     address: "0xc0634090f2fe6c6d75e61be2b949464abb498973", decimals: 18 },
    { symbol: "BRETT",   address: "0x532f27101965dd16442e59d40670faf5ebb142e4", decimals: 18 },
    { symbol: "VIRTUAL", address: "0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b", decimals: 18 },
  ];

  for (const t of tokenFeeds) {
    await priceOracle.setPriceFeed(t.address, ZERO_ADDRESS, t.decimals);
    console.log(`   ${t.symbol} feed registered (TWAP-only, ${t.decimals} decimals)`);
  }

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log("\n========== DEPLOYMENT COMPLETE ==========");
  console.log("AerodromeMultihopAdapter:", adapterAddress);
  console.log("Primary router updated on LiquidationEngine");
  console.log("14 new tokens whitelisted in TokenValidator");
  console.log("14 new price feeds registered in PriceOracle");
  console.log("=========================================\n");
  console.log("NEXT STEPS:");
  console.log("1. Run the price bot to set initial TWAP prices for new tokens");
  console.log("2. Update frontend COLLATERAL_TOKENS in lib/contracts.ts");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
