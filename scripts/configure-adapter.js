import pkg from "hardhat";
const { ethers } = pkg;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Configuring with account:", deployer.address);

  const ADAPTER = "0x94c1C12dAE564e445839c9A560808c151d793a18";
  const LIQUIDATION_ENGINE = "0x6e892AEadda28E630bbe84e469fdA25f1B1B4820";
  const TOKEN_VALIDATOR = "0xe0CA16261405CA12F156E2F3A0B309d9587B9e4D";
  const PRICE_ORACLE = "0xc8Fb5BCaC3501E060e6AFb89cd0723BCC98f1e08";
  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

  const adapter = await ethers.getContractAt("AerodromeMultihopAdapter", ADAPTER);
  const tokenValidator = await ethers.getContractAt("TokenValidator", TOKEN_VALIDATOR);
  const priceOracle = await ethers.getContractAt("PriceOracle", PRICE_ORACLE);
  const liquidationEngine = await ethers.getContractAt("LiquidationEngine", LIQUIDATION_ENGINE);

  // Helper: send tx, wait for confirmation, then pause
  async function sendTx(label, txPromise) {
    const tx = await txPromise;
    await tx.wait();
    console.log(`   ${label}`);
    await sleep(2000);
  }

  // ============================================================
  // 1. Configure routes on adapter
  // ============================================================
  console.log("\n1. Configuring routes...");

  // Stable pools
  await sendTx("DAI: stable", adapter.setStablePool("0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", true));
  await sendTx("USDbC: stable", adapter.setStablePool("0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA", true));

  // Multi-hop existing tokens
  await sendTx("cbETH: multihop", adapter.setMultihopRoute("0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22", true, false, false));
  await sendTx("LINK: multihop", adapter.setMultihopRoute("0x88Fb150BDc53A65fe94Dea0c9BA0a6dAf8C6e196", true, false, false));
  await sendTx("UNI: multihop", adapter.setMultihopRoute("0xc3De830EA07524a0761646a6a4e4be0e114a3C83", true, false, false));
  await sendTx("CYPR: multihop", adapter.setMultihopRoute("0xD262A4c7108C8139b2B189758e8D17c3DFC91a38", true, false, false));

  // Multi-hop new tokens
  await sendTx("REI: multihop", adapter.setMultihopRoute("0x6b2504a03ca4d43d0d73776f6ad46dab2f2a4cfd", true, false, false));
  await sendTx("AVNT: multihop", adapter.setMultihopRoute("0x696f9436b67233384889472cd7cd58a6fb5df4f1", true, false, false));
  await sendTx("MOCA: multihop", adapter.setMultihopRoute("0x2b11834ed1feaed4b4b3a86a6f571315e25a884d", true, false, false));

  // ============================================================
  // 2. Set as primary router
  // ============================================================
  console.log("\n2. Setting primary router...");
  await sendTx("Primary router updated", liquidationEngine.setPrimaryRouter(ADAPTER));

  // ============================================================
  // 3. Whitelist new tokens
  // ============================================================
  console.log("\n3. Whitelisting tokens...");

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
    await sendTx(`${t.symbol} whitelisted`, tokenValidator.whitelistToken(t.address));
  }

  // ============================================================
  // 4. Register price feeds (TWAP-only)
  // ============================================================
  console.log("\n4. Registering price feeds...");

  for (const t of newTokens) {
    await sendTx(`${t.symbol} feed registered`, priceOracle.setPriceFeed(t.address, ZERO_ADDRESS, 18));
  }

  console.log("\n========== ALL DONE ==========");
  console.log("Adapter configured:", ADAPTER);
  console.log("14 tokens whitelisted + price feeds registered");
  console.log("==============================\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
