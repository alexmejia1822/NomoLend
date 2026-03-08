import { NextResponse } from "next/server";
import { createPublicClient, http, formatUnits } from "viem";
import { base } from "viem/chains";
import { CONTRACTS } from "@/lib/contracts";

const client = createPublicClient({
  chain: base,
  transport: http(process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org"),
});

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

// Rate limiting (10s)
let lastCallTimestamp = 0;
const RATE_LIMIT_MS = 10_000;

// Health factor threshold: loans below 1.2 are "risky"
const RISKY_HF_THRESHOLD = 12000; // 1.2 in BPS

interface ScannedLoan {
  id: number;
  borrower: string;
  lender: string;
  principal: string;
  collateralToken: string;
  healthFactor: string;
  healthFactorRaw: number;
  isRisky: boolean;
  liquidatable: boolean;
  liquidationReason: string | null;
  duration: number;
  startTimestamp: number;
}

export async function GET() {
  const now = Date.now();
  if (lastCallTimestamp && now - lastCallTimestamp < RATE_LIMIT_MS) {
    return NextResponse.json({ error: "Rate limited — intenta de nuevo en 10 segundos" }, { status: 429 });
  }
  lastCallTimestamp = now;

  try {
    const nextLoanId = await client.readContract({
      address: CONTRACTS.LoanManager, abi: LoanManagerABI, functionName: "nextLoanId",
    });

    const total = Number(nextLoanId);
    const riskyLoans: ScannedLoan[] = [];
    const liquidatableLoans: ScannedLoan[] = [];
    let activeCount = 0;

    for (let i = 0; i < total && i < 100; i++) {
      try {
        const loan = await client.readContract({
          address: CONTRACTS.LoanManager, abi: LoanManagerABI,
          functionName: "getLoan", args: [BigInt(i)],
        });

        // status 0 = Active
        if (Number(loan.status) !== 0) continue;
        activeCount++;

        let hfRaw = 0;
        let hfStr = "N/A";
        let liquidatable = false;
        let liquidationReason: string | null = null;

        try {
          const hfVal = await client.readContract({
            address: CONTRACTS.LoanManager, abi: LoanManagerABI,
            functionName: "getLoanHealthFactor", args: [BigInt(i)],
          });
          hfRaw = Number(hfVal);
          hfStr = (hfRaw / 10000).toFixed(3);

          const [expired, undercol] = await client.readContract({
            address: CONTRACTS.LoanManager, abi: LoanManagerABI,
            functionName: "isLoanLiquidatable", args: [BigInt(i)],
          });
          liquidatable = expired || undercol;
          if (expired && undercol) liquidationReason = "expirado + subcollateralizado";
          else if (expired) liquidationReason = "expirado";
          else if (undercol) liquidationReason = "subcollateralizado";
        } catch {
          // Could not fetch health — treat as unknown
        }

        const isRisky = hfRaw > 0 && hfRaw < RISKY_HF_THRESHOLD;
        const scanned: ScannedLoan = {
          id: i,
          borrower: loan.borrower,
          lender: loan.lender,
          principal: formatUnits(loan.principal, 6),
          collateralToken: loan.collateralToken,
          healthFactor: hfStr,
          healthFactorRaw: hfRaw,
          isRisky,
          liquidatable,
          liquidationReason,
          duration: Number(loan.duration),
          startTimestamp: Number(loan.startTimestamp),
        };

        if (liquidatable) liquidatableLoans.push(scanned);
        if (isRisky) riskyLoans.push(scanned);
      } catch {
        // Skip loans that fail to read
      }
    }

    return NextResponse.json({
      totalLoans: total,
      activeLoans: activeCount,
      riskyLoans,
      liquidatableLoans,
      riskyCount: riskyLoans.length,
      liquidatableCount: liquidatableLoans.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
