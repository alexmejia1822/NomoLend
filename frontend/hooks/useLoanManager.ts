import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits } from "viem";
import { CONTRACTS } from "@/lib/contracts";
import { LoanManagerABI, ERC20ABI } from "@/lib/abis";

export function useLoan(loanId: bigint) {
  return useReadContract({
    address: CONTRACTS.LoanManager,
    abi: LoanManagerABI,
    functionName: "getLoan",
    args: [loanId],
  });
}

export function useCurrentDebt(loanId: bigint) {
  return useReadContract({
    address: CONTRACTS.LoanManager,
    abi: LoanManagerABI,
    functionName: "getCurrentDebt",
    args: [loanId],
  });
}

export function useLoanHealthFactor(loanId: bigint) {
  return useReadContract({
    address: CONTRACTS.LoanManager,
    abi: LoanManagerABI,
    functionName: "getLoanHealthFactor",
    args: [loanId],
  });
}

export function useIsLoanLiquidatable(loanId: bigint) {
  return useReadContract({
    address: CONTRACTS.LoanManager,
    abi: LoanManagerABI,
    functionName: "isLoanLiquidatable",
    args: [loanId],
  });
}

export function useBorrowerLoans(borrower: `0x${string}` | undefined) {
  return useReadContract({
    address: CONTRACTS.LoanManager,
    abi: LoanManagerABI,
    functionName: "getBorrowerLoans",
    args: borrower ? [borrower] : undefined,
    query: { enabled: !!borrower },
  });
}

export function useLenderLoans(lender: `0x${string}` | undefined) {
  return useReadContract({
    address: CONTRACTS.LoanManager,
    abi: LoanManagerABI,
    functionName: "getLenderLoans",
    args: lender ? [lender] : undefined,
    query: { enabled: !!lender },
  });
}

export function useTakeLoan() {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const takeLoan = (
    lendingOrderId: bigint,
    amount: string,
    collateralToken: `0x${string}`,
    collateralAmount: string,
    collateralDecimals: number
  ) => {
    writeContract({
      address: CONTRACTS.LoanManager,
      abi: LoanManagerABI,
      functionName: "takeLoan",
      args: [
        lendingOrderId,
        parseUnits(amount, 6),
        collateralToken,
        parseUnits(collateralAmount, collateralDecimals),
      ],
    });
  };

  return { takeLoan, isPending, isConfirming, isSuccess, hash };
}

export function useFillBorrowRequest() {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const fillRequest = (borrowRequestId: bigint, amount: string) => {
    writeContract({
      address: CONTRACTS.LoanManager,
      abi: LoanManagerABI,
      functionName: "fillBorrowRequest",
      args: [borrowRequestId, parseUnits(amount, 6)],
    });
  };

  return { fillRequest, isPending, isConfirming, isSuccess, hash };
}

export function useRepayLoan() {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const repay = (loanId: bigint) => {
    writeContract({
      address: CONTRACTS.LoanManager,
      abi: LoanManagerABI,
      functionName: "repayLoan",
      args: [loanId],
    });
  };

  return { repay, isPending, isConfirming, isSuccess, hash };
}
