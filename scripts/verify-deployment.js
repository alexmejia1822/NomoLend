import pkg from "hardhat";
const { ethers } = pkg;

async function main() {
  const ADAPTER = "0x94c1C12dAE564e445839c9A560808c151d793a18";
  const LE = "0x6e892AEadda28E630bbe84e469fdA25f1B1B4820";
  const TV = "0xe0CA16261405CA12F156E2F3A0B309d9587B9e4D";
  const PO = "0xc8Fb5BCaC3501E060e6AFb89cd0723BCC98f1e08";

  const le = await ethers.getContractAt("LiquidationEngine", LE);
  const tv = await ethers.getContractAt("TokenValidator", TV);
  const po = await ethers.getContractAt("PriceOracle", PO);

  // 1. Check primary router
  const primaryRouter = await le.primaryRouter();
  console.log("=== LiquidationEngine ===");
  console.log("Primary Router:", primaryRouter);
  console.log("Correct:", primaryRouter.toLowerCase() === ADAPTER.toLowerCase() ? "YES" : "NO");

  // 2. Check all tokens whitelisted
  const tokens = [
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

  console.log("\n=== TokenValidator (whitelisted) ===");
  let allWhitelisted = true;
  for (const t of tokens) {
    const ok = await tv.whitelistedTokens(t.address);
    console.log(`  ${t.symbol.padEnd(8)} ${ok ? "YES" : "NO"}`);
    if (!ok) allWhitelisted = false;
  }

  console.log("\n=== PriceOracle (feeds active) ===");
  let allFeeds = true;
  for (const t of tokens) {
    const feed = await po.priceFeeds(t.address);
    const active = feed[5]; // isActive
    console.log(`  ${t.symbol.padEnd(8)} ${active ? "YES" : "NO"}`);
    if (!active) allFeeds = false;
  }

  console.log("\n=== SUMMARY ===");
  console.log("Primary Router set:", primaryRouter.toLowerCase() === ADAPTER.toLowerCase() ? "OK" : "FAIL");
  console.log("All tokens whitelisted:", allWhitelisted ? "OK" : "FAIL");
  console.log("All price feeds active:", allFeeds ? "OK" : "FAIL");
}
main();
