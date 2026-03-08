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
] as const;

const RiskEngineABI = [
  { inputs: [{ name: "token", type: "address" }], name: "pausedTokens", outputs: [{ type: "bool" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "token", type: "address" }], name: "tokenRiskParams", outputs: [
    { name: "ltvBps", type: "uint256" }, { name: "liquidationThresholdBps", type: "uint256" },
    { name: "maxExposure", type: "uint256" }, { name: "isActive", type: "bool" },
  ], stateMutability: "view", type: "function" },
  { inputs: [{ name: "token", type: "address" }], name: "currentExposure", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
] as const;

const LoanManagerABI = [
  { inputs: [], name: "nextLoanId", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
] as const;

const ReserveFundABI = [
  { inputs: [], name: "getReserveBalance", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
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

// Thresholds
const ORACLE_STALE_SECONDS = 1800; // 30 min
const RESERVE_MIN_USDC = 10; // $10

interface TokenHealth {
  symbol: string;
  address: string;
  price: string;
  lastUpdate: number;
  staleMinutes: number;
  isStale: boolean;
  paused: boolean;
  ltvBps: number;
  exposure: string;
  maxExposure: string;
  exposurePercent: number;
  isActive: boolean;
}

interface ProtocolHealth {
  status: "healthy" | "warning" | "critical";
  totalLoans: number;
  reserveFund: string;
  reserveLow: boolean;
  tokens: TokenHealth[];
  issues: string[];
  timestamp: string;
}

export async function GET() {
  const now = Date.now();
  if (lastCallTimestamp && now - lastCallTimestamp < RATE_LIMIT_MS) {
    return NextResponse.json({ error: "Rate limited — intenta de nuevo en 10 segundos" }, { status: 429 });
  }
  lastCallTimestamp = now;

  try {
    const issues: string[] = [];
    const nowSeconds = Math.floor(now / 1000);

    // Protocol-level data
    const [nextLoanId, reserveBalance] = await Promise.all([
      client.readContract({ address: CONTRACTS.LoanManager, abi: LoanManagerABI, functionName: "nextLoanId" }),
      client.readContract({ address: CONTRACTS.ReserveFund, abi: ReserveFundABI, functionName: "getReserveBalance" }),
    ]);

    const reserveUsdc = Number(formatUnits(reserveBalance, 6));
    const reserveLow = reserveUsdc < RESERVE_MIN_USDC;
    if (reserveLow) {
      issues.push(`Reserve Fund bajo: $${reserveUsdc.toFixed(2)} USDC (minimo: $${RESERVE_MIN_USDC})`);
    }

    // Token-level health
    const tokens: TokenHealth[] = [];

    for (const { symbol, address } of MONITOR_TOKENS) {
      try {
        const [feed, paused, params, exposure] = await Promise.all([
          client.readContract({ address: CONTRACTS.PriceOracle, abi: PriceOracleABI, functionName: "priceFeeds", args: [address] }),
          client.readContract({ address: CONTRACTS.RiskEngine, abi: RiskEngineABI, functionName: "pausedTokens", args: [address] }),
          client.readContract({ address: CONTRACTS.RiskEngine, abi: RiskEngineABI, functionName: "tokenRiskParams", args: [address] }),
          client.readContract({ address: CONTRACTS.RiskEngine, abi: RiskEngineABI, functionName: "currentExposure", args: [address] }),
        ]);

        const isActive = feed[5];
        if (!isActive) continue;

        const twapPrice = feed[2];
        const lastUpdate = Number(feed[3]);
        const staleness = nowSeconds - lastUpdate;
        const isStale = staleness > ORACLE_STALE_SECONDS;

        const maxExp = Number(formatUnits(params[2], 6));
        const curExp = Number(formatUnits(exposure, 6));
        const exposurePercent = maxExp > 0 ? (curExp / maxExp) * 100 : 0;

        if (isStale) {
          issues.push(`${symbol}: precio stale (${Math.floor(staleness / 60)} min sin actualizar)`);
        }
        if (paused) {
          issues.push(`${symbol}: token pausado en RiskEngine`);
        }
        if (exposurePercent > 80) {
          issues.push(`${symbol}: exposicion alta (${exposurePercent.toFixed(1)}% del maximo)`);
        }

        tokens.push({
          symbol,
          address,
          price: formatUnits(twapPrice, 6),
          lastUpdate,
          staleMinutes: Math.floor(staleness / 60),
          isStale,
          paused: paused as boolean,
          ltvBps: Number(params[0]),
          exposure: formatUnits(exposure, 6),
          maxExposure: formatUnits(params[2], 6),
          exposurePercent: Math.round(exposurePercent * 10) / 10,
          isActive: params[3] as boolean,
        });
      } catch {
        // Skip tokens that fail
      }
    }

    // Determine overall status
    let status: ProtocolHealth["status"] = "healthy";
    const hasCritical = tokens.some((t) => t.paused) || reserveLow;
    const hasWarning = tokens.some((t) => t.isStale || t.exposurePercent > 80);
    if (hasCritical) status = "critical";
    else if (hasWarning) status = "warning";

    const result: ProtocolHealth = {
      status,
      totalLoans: Number(nextLoanId),
      reserveFund: reserveUsdc.toFixed(2),
      reserveLow,
      tokens,
      issues,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
