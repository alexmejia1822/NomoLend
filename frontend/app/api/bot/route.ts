import { NextRequest, NextResponse } from "next/server";
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
  { inputs: [{ name: "loanId", type: "uint256" }], name: "getLoan", outputs: [{ components: [
    { name: "loanId", type: "uint256" }, { name: "lender", type: "address" },
    { name: "borrower", type: "address" }, { name: "principal", type: "uint256" },
    { name: "collateralToken", type: "address" }, { name: "collateralAmount", type: "uint256" },
    { name: "startTimestamp", type: "uint256" }, { name: "duration", type: "uint8" },
    { name: "status", type: "uint8" }, { name: "interestPaid", type: "uint256" },
    { name: "repaidAt", type: "uint256" },
  ], type: "tuple" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "loanId", type: "uint256" }], name: "getLoanHealthFactor", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "loanId", type: "uint256" }], name: "isLoanLiquidatable", outputs: [
    { name: "expired", type: "bool" }, { name: "undercollateralized", type: "bool" },
  ], stateMutability: "view", type: "function" },
] as const;

const ReserveFundABI = [
  { inputs: [], name: "getReserveBalance", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
] as const;

// Simple rate limiting
const lastCalls: Record<string, number> = {};
const RATE_LIMIT_MS = 2_000; // 2 seconds

function rateLimited(key: string): boolean {
  const now = Date.now();
  if (lastCalls[key] && now - lastCalls[key] < RATE_LIMIT_MS) return true;
  lastCalls[key] = now;
  return false;
}

// Token list for monitoring
const MONITOR_TOKENS = [
  { symbol: "WETH", address: "0x4200000000000000000000000000000000000006" as `0x${string}` },
  { symbol: "cbETH", address: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22" as `0x${string}` },
  { symbol: "DAI", address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb" as `0x${string}` },
  { symbol: "LINK", address: "0x88Fb150BDc53A65fe94Dea0c9BA0a6dAf8C6e196" as `0x${string}` },
  { symbol: "UNI", address: "0xc3De830EA07524a0761646a6a4e4be0e114a3C83" as `0x${string}` },
  { symbol: "CYPR", address: "0xD262A4c7108C8139b2B189758e8D17c3DFC91a38" as `0x${string}` },
  { symbol: "REI", address: "0x6b2504a03ca4d43d0d73776f6ad46dab2f2a4cfd" as `0x${string}` },
  { symbol: "AVNT", address: "0x696f9436b67233384889472cd7cd58a6fb5df4f1" as `0x${string}` },
  { symbol: "GHST", address: "0xcd2f22236dd9dfe2356d7c543161d4d260fd9bcb" as `0x${string}` },
  { symbol: "VFY", address: "0xa749de6c28262b7ffbc5de27dc845dd7ecd2b358" as `0x${string}` },
  { symbol: "ZRO", address: "0x6985884c4392d348587b19cb9eaaf157f13271cd" as `0x${string}` },
  { symbol: "TIG", address: "0x0c03ce270b4826ec62e7dd007f0b716068639f7b" as `0x${string}` },
  { symbol: "BID", address: "0xa1832f7f4e534ae557f9b5ab76de54b1873e498b" as `0x${string}` },
  { symbol: "MAMO", address: "0x7300b37dfdfab110d83290a29dfb31b1740219fe" as `0x${string}` },
  { symbol: "GIZA", address: "0x590830dfdf9a3f68afcdde2694773debdf267774" as `0x${string}` },
  { symbol: "MOCA", address: "0x2b11834ed1feaed4b4b3a86a6f571315e25a884d" as `0x${string}` },
  { symbol: "AVAIL", address: "0xd89d90d26b48940fa8f58385fe84625d468e057a" as `0x${string}` },
  { symbol: "KTA", address: "0xc0634090f2fe6c6d75e61be2b949464abb498973" as `0x${string}` },
  { symbol: "BRETT", address: "0x532f27101965dd16442e59d40670faf5ebb142e4" as `0x${string}` },
  { symbol: "VIRTUAL", address: "0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b" as `0x${string}` },
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") || "status";

  if (rateLimited(action)) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  try {
    switch (action) {
      case "status":
        return NextResponse.json(await getProtocolStatus());
      case "loans":
        return NextResponse.json(await getActiveLoans());
      case "tokens":
        return NextResponse.json(await getTokenStatus());
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function getProtocolStatus() {
  const [nextLoanId, reserveBalance] = await Promise.all([
    client.readContract({ address: CONTRACTS.LoanManager, abi: LoanManagerABI, functionName: "nextLoanId" }),
    client.readContract({ address: CONTRACTS.ReserveFund, abi: ReserveFundABI, functionName: "getReserveBalance" }),
  ]);

  return {
    totalLoans: Number(nextLoanId),
    reserveFund: formatUnits(reserveBalance, 6),
    timestamp: new Date().toISOString(),
  };
}

async function getActiveLoans() {
  const nextLoanId = await client.readContract({
    address: CONTRACTS.LoanManager, abi: LoanManagerABI, functionName: "nextLoanId",
  });

  const total = Number(nextLoanId);
  const loans = [];

  for (let i = 0; i < total && i < 50; i++) {
    try {
      const loan = await client.readContract({
        address: CONTRACTS.LoanManager, abi: LoanManagerABI, functionName: "getLoan", args: [BigInt(i)],
      });
      if (Number(loan.status) !== 0) continue;

      let hf = "N/A";
      let liquidatable = false;
      try {
        const hfVal = await client.readContract({
          address: CONTRACTS.LoanManager, abi: LoanManagerABI, functionName: "getLoanHealthFactor", args: [BigInt(i)],
        });
        hf = (Number(hfVal) / 10000).toFixed(3);

        const [expired, undercol] = await client.readContract({
          address: CONTRACTS.LoanManager, abi: LoanManagerABI, functionName: "isLoanLiquidatable", args: [BigInt(i)],
        });
        liquidatable = expired || undercol;
      } catch {}

      loans.push({
        id: i,
        borrower: loan.borrower,
        lender: loan.lender,
        principal: formatUnits(loan.principal, 6),
        collateralToken: loan.collateralToken,
        healthFactor: hf,
        liquidatable,
        duration: Number(loan.duration),
        startTimestamp: Number(loan.startTimestamp),
      });
    } catch {}
  }

  return { loans, total };
}

async function getTokenStatus() {
  const now = Math.floor(Date.now() / 1000);
  const tokens = [];

  for (const { symbol, address } of MONITOR_TOKENS) {
    try {
      const [feed, paused, params, exposure] = await Promise.all([
        client.readContract({ address: CONTRACTS.PriceOracle, abi: PriceOracleABI, functionName: "priceFeeds", args: [address] }),
        client.readContract({ address: CONTRACTS.RiskEngine, abi: RiskEngineABI, functionName: "pausedTokens", args: [address] }),
        client.readContract({ address: CONTRACTS.RiskEngine, abi: RiskEngineABI, functionName: "tokenRiskParams", args: [address] }),
        client.readContract({ address: CONTRACTS.RiskEngine, abi: RiskEngineABI, functionName: "currentExposure", args: [address] }),
      ]);

      // feed: [chainlinkFeed, chainlinkDecimals, twapPrice, lastTwapUpdate, tokenDecimals, isActive]
      const feedActive = feed[5];
      if (!feedActive) continue;

      const twapPrice = feed[2];
      const lastTwapUpdate = Number(feed[3]);
      const staleness = now - lastTwapUpdate;
      // params: [ltvBps, liquidationThresholdBps, maxExposure, isActive]
      tokens.push({
        symbol,
        address,
        price: formatUnits(twapPrice, 6),
        lastUpdate: lastTwapUpdate,
        staleMinutes: Math.floor(staleness / 60),
        isStale: staleness > 1800,
        paused,
        ltvBps: Number(params[0]),
        exposure: formatUnits(exposure, 6),
        maxExposure: formatUnits(params[2], 6),
        isActive: params[3] as boolean,
      });
    } catch {}
  }

  return { tokens };
}
