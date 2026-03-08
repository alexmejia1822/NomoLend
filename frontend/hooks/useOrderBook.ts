import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits } from "viem";
import { CONTRACTS } from "@/lib/contracts";
import { OrderBookABI, ERC20ABI } from "@/lib/abis";

export function useLendingOrderCount() {
  return useReadContract({
    address: CONTRACTS.OrderBook,
    abi: OrderBookABI,
    functionName: "nextLendingOrderId",
  });
}

export function useBorrowRequestCount() {
  return useReadContract({
    address: CONTRACTS.OrderBook,
    abi: OrderBookABI,
    functionName: "nextBorrowRequestId",
  });
}

export function useLendingOrder(orderId: bigint) {
  return useReadContract({
    address: CONTRACTS.OrderBook,
    abi: OrderBookABI,
    functionName: "getLendingOrder",
    args: [orderId],
  });
}

export function useBorrowRequest(requestId: bigint) {
  return useReadContract({
    address: CONTRACTS.OrderBook,
    abi: OrderBookABI,
    functionName: "getBorrowRequest",
    args: [requestId],
  });
}

export function useUserLendingOrders(user: `0x${string}` | undefined) {
  return useReadContract({
    address: CONTRACTS.OrderBook,
    abi: OrderBookABI,
    functionName: "getUserLendingOrders",
    args: user ? [user] : undefined,
    query: { enabled: !!user },
  });
}

export function useUserBorrowRequests(user: `0x${string}` | undefined) {
  return useReadContract({
    address: CONTRACTS.OrderBook,
    abi: OrderBookABI,
    functionName: "getUserBorrowRequests",
    args: user ? [user] : undefined,
    query: { enabled: !!user },
  });
}

export function useApproveUsdc() {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const approve = (spender: `0x${string}`, amount: string) => {
    writeContract({
      address: CONTRACTS.USDC,
      abi: ERC20ABI,
      functionName: "approve",
      args: [spender, parseUnits(amount, 6)],
    });
  };

  return { approve, isPending, isConfirming, isSuccess, hash };
}

export function useCreateLendingOrder() {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const createOrder = (amount: string, duration: number) => {
    writeContract({
      address: CONTRACTS.OrderBook,
      abi: OrderBookABI,
      functionName: "createLendingOrder",
      args: [parseUnits(amount, 6), duration],
    });
  };

  return { createOrder, isPending, isConfirming, isSuccess, hash };
}

export function useCancelLendingOrder() {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const cancel = (orderId: bigint) => {
    writeContract({
      address: CONTRACTS.OrderBook,
      abi: OrderBookABI,
      functionName: "cancelLendingOrder",
      args: [orderId],
    });
  };

  return { cancel, isPending, isConfirming, isSuccess, hash };
}

export function useCreateBorrowRequest() {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const createRequest = (
    amount: string,
    collateralToken: `0x${string}`,
    collateralAmount: string,
    collateralDecimals: number,
    duration: number
  ) => {
    writeContract({
      address: CONTRACTS.OrderBook,
      abi: OrderBookABI,
      functionName: "createBorrowRequest",
      args: [
        parseUnits(amount, 6),
        collateralToken,
        parseUnits(collateralAmount, collateralDecimals),
        duration,
      ],
    });
  };

  return { createRequest, isPending, isConfirming, isSuccess, hash };
}

export function useCancelBorrowRequest() {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const cancel = (requestId: bigint) => {
    writeContract({
      address: CONTRACTS.OrderBook,
      abi: OrderBookABI,
      functionName: "cancelBorrowRequest",
      args: [requestId],
    });
  };

  return { cancel, isPending, isConfirming, isSuccess, hash };
}
