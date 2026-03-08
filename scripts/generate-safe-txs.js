import pkg from "hardhat";
const { ethers } = pkg;

async function main() {
  const ADAPTER = "0x94c1C12dAE564e445839c9A560808c151d793a18";
  const LE = "0x6e892AEadda28E630bbe84e469fdA25f1B1B4820";
  const TV = "0xe0CA16261405CA12F156E2F3A0B309d9587B9e4D";
  const PO = "0xc8Fb5BCaC3501E060e6AFb89cd0723BCC98f1e08";
  const ZERO = "0x0000000000000000000000000000000000000000";

  const le = await ethers.getContractAt("LiquidationEngine", LE);
  const tv = await ethers.getContractAt("TokenValidator", TV);
  const po = await ethers.getContractAt("PriceOracle", PO);

  const newTokens = [
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

  console.log("=== SAFE MULTISIG TRANSACTIONS ===\n");
  console.log("Use Safe Transaction Builder (https://app.safe.global)\n");

  // TX 1: Set primary router
  console.log("--- TX 1: LiquidationEngine.setPrimaryRouter ---");
  console.log("To:", LE);
  console.log("Value: 0");
  console.log("Data:", le.interface.encodeFunctionData("setPrimaryRouter", [ADAPTER]));
  console.log("");

  // TX 2-15: Whitelist tokens
  for (let i = 0; i < newTokens.length; i++) {
    const t = newTokens[i];
    console.log(`--- TX ${i + 2}: TokenValidator.whitelistToken(${t.symbol}) ---`);
    console.log("To:", TV);
    console.log("Value: 0");
    console.log("Data:", tv.interface.encodeFunctionData("whitelistToken", [t.address]));
    console.log("");
  }

  // TX 16-29: Register price feeds
  for (let i = 0; i < newTokens.length; i++) {
    const t = newTokens[i];
    console.log(`--- TX ${i + 16}: PriceOracle.setPriceFeed(${t.symbol}) ---`);
    console.log("To:", PO);
    console.log("Value: 0");
    console.log("Data:", po.interface.encodeFunctionData("setPriceFeed", [t.address, ZERO, t.decimals]));
    console.log("");
  }

  console.log("=== TOTAL: 29 transactions ===");
  console.log("Tip: Use Safe Transaction Builder to batch all in one multisig approval");
}
main();
