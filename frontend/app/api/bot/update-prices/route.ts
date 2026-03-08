import { NextResponse } from "next/server";
import { createPublicClient, http, formatUnits } from "viem";
import { base } from "viem/chains";
import { CONTRACTS } from "@/lib/contracts";

const client = createPublicClient({
  chain: base,
  transport: http(process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org"),
});

const PriceOracleABI = [
  { inputs: [{ name: "token", type: "address" }], name: "priceFeeds", outputs: [
    { name: "chainlinkFeed", type: "address" }, { name: "chainlinkDecimals", type: "uint8" },
    { name: "twapPrice", type: "uint256" }, { name: "lastTwapUpdate", type: "uint256" },
    { name: "tokenDecimals", type: "uint8" }, { name: "isActive", type: "bool" },
  ], stateMutability: "view", type: "function" },
  { inputs: [{ name: "token", type: "address" }], name: "getPrice", outputs: [
    { name: "price", type: "uint256" }, { name: "confidence", type: "bool" },
  ], stateMutability: "view", type: "function" },
] as const;

const MONITOR_TOKENS: ReadonlyArray<{ symbol: string; address: `0x${string}` }> = [
  { symbol: "WETH", address: "0x4200000000000000000000000000000000000006" },
  { symbol: "cbETH", address: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22" },
  { symbol: "DAI", address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb" },
  { symbol: "LINK", address: "0x88Fb150BDc53A65fe94Dea0c9BA0a6dAf8C6e196" },
  { symbol: "UNI", address: "0xc3De830EA07524a0761646a6a4e4be0e114a3C83" },
  { symbol: "CYPR", address: "0xD262A4c7108C8139b2B189758e8D17c3DFC91a38" },
  { symbol: "REI", address: "0x6b2504a03ca4d43d0d73776f6ad46dab2f2a4cfd" },
  { symbol: "AVNT", address: "0x696f9436b67233384889472cd7cd58a6fb5df4f1" },
  { symbol: "GHST", address: "0xcd2f22236dd9dfe2356d7c543161d4d260fd9bcb" },
  { symbol: "VFY", address: "0xa749de6c28262b7ffbc5de27dc845dd7ecd2b358" },
  { symbol: "ZRO", address: "0x6985884c4392d348587b19cb9eaaf157f13271cd" },
  { symbol: "TIG", address: "0x0c03ce270b4826ec62e7dd007f0b716068639f7b" },
  { symbol: "BID", address: "0xa1832f7f4e534ae557f9b5ab76de54b1873e498b" },
  { symbol: "MAMO", address: "0x7300b37dfdfab110d83290a29dfb31b1740219fe" },
  { symbol: "GIZA", address: "0x590830dfdf9a3f68afcdde2694773debdf267774" },
  { symbol: "MOCA", address: "0x2b11834ed1feaed4b4b3a86a6f571315e25a884d" },
  { symbol: "AVAIL", address: "0xd89d90d26b48940fa8f58385fe84625d468e057a" },
  { symbol: "KTA", address: "0xc0634090f2fe6c6d75e61be2b949464abb498973" },
  { symbol: "BRETT", address: "0x532f27101965dd16442e59d40670faf5ebb142e4" },
  { symbol: "VIRTUAL", address: "0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b" },
];

// Rate limiting (10s)
let lastCallTimestamp = 0;
const RATE_LIMIT_MS = 10_000;

interface TokenPrice {
  symbol: string;
  address: string;
  twapPrice: string;
  chainlinkPrice: string;
  confidence: boolean;
  lastUpdate: number;
  staleMinutes: number;
  isStale: boolean;
  isActive: boolean;
}

export async function GET() {
  const now = Date.now();
  if (lastCallTimestamp && now - lastCallTimestamp < RATE_LIMIT_MS) {
    return NextResponse.json({ error: "Rate limited — intenta de nuevo en 10 segundos" }, { status: 429 });
  }
  lastCallTimestamp = now;

  try {
    const nowSeconds = Math.floor(now / 1000);
    const prices: TokenPrice[] = [];

    for (const { symbol, address } of MONITOR_TOKENS) {
      try {
        const [feed, priceData] = await Promise.all([
          client.readContract({
            address: CONTRACTS.PriceOracle, abi: PriceOracleABI,
            functionName: "priceFeeds", args: [address],
          }),
          client.readContract({
            address: CONTRACTS.PriceOracle, abi: PriceOracleABI,
            functionName: "getPrice", args: [address],
          }),
        ]);

        const isActive = feed[5];
        if (!isActive) continue;

        const twapPrice = feed[2];
        const lastUpdate = Number(feed[3]);
        const staleness = nowSeconds - lastUpdate;

        prices.push({
          symbol,
          address,
          twapPrice: formatUnits(twapPrice, 6),
          chainlinkPrice: formatUnits(priceData[0], 6),
          confidence: priceData[1],
          lastUpdate,
          staleMinutes: Math.floor(staleness / 60),
          isStale: staleness > 1800, // 30 min
          isActive,
        });
      } catch {
        // Skip tokens that fail — feed may not be configured
      }
    }

    return NextResponse.json({
      prices,
      totalTokens: prices.length,
      staleCount: prices.filter((p) => p.isStale).length,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
