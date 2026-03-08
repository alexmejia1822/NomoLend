import pkg from "hardhat";
const { ethers } = pkg;
import { writeFileSync } from "fs";

async function main() {
  const RE = "0xc5E0fDDB27bB10Efb341654dAbeA55d3Cc09870F";
  const re = await ethers.getContractAt("RiskEngine", RE);

  const CAP_20K = ethers.parseUnits("20000", 6);

  const tokens = [
    // Tier B: >$100M market cap
    { symbol: "ZRO",     address: "0x6985884c4392d348587b19cb9eaaf157f13271cd", ltv: 3500, liq: 5500, exposure: CAP_20K },
    { symbol: "BRETT",   address: "0x532f27101965dd16442e59d40670faf5ebb142e4", ltv: 3500, liq: 5500, exposure: CAP_20K },
    { symbol: "VIRTUAL", address: "0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b", ltv: 3500, liq: 5500, exposure: CAP_20K },
    { symbol: "MOCA",    address: "0x2b11834ed1feaed4b4b3a86a6f571315e25a884d", ltv: 3500, liq: 5500, exposure: CAP_20K },

    // Tier C: >$50M market cap
    { symbol: "GHST",    address: "0xcd2f22236dd9dfe2356d7c543161d4d260fd9bcb", ltv: 3000, liq: 5000, exposure: CAP_20K },
    { symbol: "AVAIL",   address: "0xd89d90d26b48940fa8f58385fe84625d468e057a", ltv: 3000, liq: 5000, exposure: CAP_20K },
    { symbol: "TIG",     address: "0x0c03ce270b4826ec62e7dd007f0b716068639f7b", ltv: 3000, liq: 5000, exposure: CAP_20K },

    // Tier D: smaller tokens
    { symbol: "REI",     address: "0x6b2504a03ca4d43d0d73776f6ad46dab2f2a4cfd", ltv: 2500, liq: 5000, exposure: CAP_20K },
    { symbol: "AVNT",    address: "0x696f9436b67233384889472cd7cd58a6fb5df4f1", ltv: 2500, liq: 5000, exposure: CAP_20K },
    { symbol: "VFY",     address: "0xa749de6c28262b7ffbc5de27dc845dd7ecd2b358", ltv: 2500, liq: 5000, exposure: CAP_20K },
    { symbol: "BID",     address: "0xa1832f7f4e534ae557f9b5ab76de54b1873e498b", ltv: 2500, liq: 5000, exposure: CAP_20K },
    { symbol: "MAMO",    address: "0x7300b37dfdfab110d83290a29dfb31b1740219fe", ltv: 2500, liq: 5000, exposure: CAP_20K },
    { symbol: "GIZA",    address: "0x590830dfdf9a3f68afcdde2694773debdf267774", ltv: 2500, liq: 5000, exposure: CAP_20K },
    { symbol: "KTA",     address: "0xc0634090f2fe6c6d75e61be2b949464abb498973", ltv: 2500, liq: 5000, exposure: CAP_20K },

    // Fix CYPR: was 10,000 -> now 20,000
    { symbol: "CYPR",    address: "0xD262A4c7108C8139b2B189758e8D17c3DFC91a38", ltv: 2500, liq: 5000, exposure: CAP_20K },
  ];

  const transactions = [];
  for (const t of tokens) {
    transactions.push({
      to: RE,
      value: "0",
      data: re.interface.encodeFunctionData("setTokenRiskParams", [t.address, t.ltv, t.liq, t.exposure]),
      contractMethod: null,
      contractInputsValues: null,
    });
  }

  const batch = {
    version: "1.0",
    chainId: "8453",
    createdAt: Date.now(),
    meta: {
      name: "NomoLend: Set risk params for 14 new tokens + fix CYPR",
      description: "All tokens capped at 20,000 USDC exposure. CYPR updated from 10K to 20K.",
      txBuilderVersion: "1.16.5",
    },
    transactions,
  };

  writeFileSync("safe-batch-risk-params.json", JSON.stringify(batch, null, 2));
  console.log("Written: safe-batch-risk-params.json");
  console.log(`Total transactions: ${transactions.length}\n`);

  for (const t of tokens) {
    const tier = t.ltv === 3500 ? "B" : t.ltv === 3000 ? "C" : "D";
    console.log(`  ${t.symbol.padEnd(8)} Tier ${tier} | LTV ${t.ltv/100}% | Liq ${t.liq/100}% | Exposure 20,000 USDC`);
  }
}
main();
