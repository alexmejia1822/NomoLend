import pkg from "hardhat";
const { ethers } = pkg;
import { writeFileSync } from "fs";

async function main() {
  const PO = "0xc8Fb5BCaC3501E060e6AFb89cd0723BCC98f1e08";
  const po = await ethers.getContractAt("PriceOracle", PO);

  // Fetch current prices from CoinGecko
  const ids = "unit-00-rei,avantis,aavegotchi,zkverify,layerzero,the-innovation-game,creatorbid,mamo,giza,mocaverse,avail,keeta,brett,virtual-protocol";
  
  const resp = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);
  const data = await resp.json();
  
  console.log("CoinGecko prices:", JSON.stringify(data, null, 2));

  const tokens = [
    { symbol: "REI",     address: "0x6b2504a03ca4d43d0d73776f6ad46dab2f2a4cfd", cgId: "unit-00-rei" },
    { symbol: "AVNT",    address: "0x696f9436b67233384889472cd7cd58a6fb5df4f1", cgId: "avantis" },
    { symbol: "GHST",    address: "0xcd2f22236dd9dfe2356d7c543161d4d260fd9bcb", cgId: "aavegotchi" },
    { symbol: "VFY",     address: "0xa749de6c28262b7ffbc5de27dc845dd7ecd2b358", cgId: "zkverify" },
    { symbol: "ZRO",     address: "0x6985884c4392d348587b19cb9eaaf157f13271cd", cgId: "layerzero" },
    { symbol: "TIG",     address: "0x0c03ce270b4826ec62e7dd007f0b716068639f7b", cgId: "the-innovation-game" },
    { symbol: "BID",     address: "0xa1832f7f4e534ae557f9b5ab76de54b1873e498b", cgId: "creatorbid" },
    { symbol: "MAMO",    address: "0x7300b37dfdfab110d83290a29dfb31b1740219fe", cgId: "mamo" },
    { symbol: "GIZA",    address: "0x590830dfdf9a3f68afcdde2694773debdf267774", cgId: "giza" },
    { symbol: "MOCA",    address: "0x2b11834ed1feaed4b4b3a86a6f571315e25a884d", cgId: "mocaverse" },
    { symbol: "AVAIL",   address: "0xd89d90d26b48940fa8f58385fe84625d468e057a", cgId: "avail" },
    { symbol: "KTA",     address: "0xc0634090f2fe6c6d75e61be2b949464abb498973", cgId: "keeta" },
    { symbol: "BRETT",   address: "0x532f27101965dd16442e59d40670faf5ebb142e4", cgId: "brett" },
    { symbol: "VIRTUAL", address: "0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b", cgId: "virtual-protocol" },
  ];

  const transactions = [];
  const tokenAddresses = [];
  const tokenPrices = [];

  console.log("\nTWAP prices to set (USDC 6 decimals):");
  for (const t of tokens) {
    const price = data[t.cgId]?.usd || 0;
    if (price === 0) {
      console.log(`  ${t.symbol.padEnd(8)} SKIP - no price found`);
      continue;
    }
    // Convert to USDC 6 decimals (price per 1 whole token)
    const priceUsdc = Math.round(price * 1e6);
    console.log(`  ${t.symbol.padEnd(8)} $${price} -> ${priceUsdc} (6 dec)`);
    
    tokenAddresses.push(t.address);
    tokenPrices.push(priceUsdc.toString());
  }

  // Use batchUpdateTwapPrices for efficiency
  if (tokenAddresses.length > 0) {
    transactions.push({
      to: PO,
      value: "0",
      data: po.interface.encodeFunctionData("batchUpdateTwapPrices", [tokenAddresses, tokenPrices]),
      contractMethod: null,
      contractInputsValues: null,
    });
  }

  const batch = {
    version: "1.0",
    chainId: "8453",
    createdAt: Date.now(),
    meta: {
      name: "NomoLend: Set initial TWAP prices for new tokens",
      description: "Set initial TWAP prices fetched from CoinGecko",
      txBuilderVersion: "1.16.5",
    },
    transactions,
  };

  writeFileSync("safe-batch-twap-prices.json", JSON.stringify(batch, null, 2));
  console.log(`\nWritten: safe-batch-twap-prices.json (${transactions.length} tx)`);
  console.log("Upload to Safe Transaction Builder and execute");
}
main();
