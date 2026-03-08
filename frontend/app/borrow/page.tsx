"use client";

import { useState, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { motion, AnimatePresence } from "framer-motion";
import { CONTRACTS, COLLATERAL_TOKENS } from "@/lib/contracts";
import { OrderBookABI, ERC20ABI, RiskEngineABI } from "@/lib/abis";
import {
  useCreateBorrowRequest,
  useCancelBorrowRequest,
  useBorrowRequestCount,
  useApproveUsdc,
} from "@/hooks/useOrderBook";
import { useFillBorrowRequest } from "@/hooks/useLoanManager";
import {
  getInterestLabel,
  shortenAddress,
  formatUsdc,
} from "@/lib/utils";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { TokenIcon } from "@/components/ui/TokenIcon";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { HealthBar } from "@/components/ui/HealthBar";
import { useTranslation } from "@/i18n/context";
import clsx from "clsx";
import {
  X,
  Plus,
  Clock,
  TrendingUp,
  DollarSign,
  Shield,
  HandCoins,
  Coins,
  Receipt,
  Filter,
  SlidersHorizontal,
} from "lucide-react";

function FillRequestModal({
  requestId,
  request,
  onClose,
}: {
  requestId: number;
  request: {
    borrower: string;
    requestedAmount: bigint;
    filledAmount: bigint;
    collateralToken: string;
    duration: number;
  };
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const remaining = request.requestedAmount - request.filledAmount;
  const [amount, setAmount] = useState(formatUnits(remaining, 6));
  const [step, setStep] = useState<"idle" | "approving" | "filling">("idle");

  const { approve, isSuccess: approveSuccess } = useApproveUsdc();
  const { fillRequest, isPending: isFilling, isSuccess: fillSuccess } = useFillBorrowRequest();

  const tokenInfo = COLLATERAL_TOKENS.find(
    (t) => t.address.toLowerCase() === request.collateralToken.toLowerCase()
  );

  useEffect(() => {
    if (approveSuccess && step === "approving") {
      setStep("filling");
      fillRequest(BigInt(requestId), amount);
    }
  }, [approveSuccess]);

  useEffect(() => {
    if (fillSuccess) {
      setStep("idle");
      onClose();
    }
  }, [fillSuccess]);

  const handleFill = () => {
    if (!amount || parseFloat(amount) <= 0) return;
    setStep("approving");
    approve(CONTRACTS.LoanManager, amount);
  };

  const maxAmount = formatUnits(remaining, 6);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", duration: 0.5 }}
          className="bg-bg-card border border-border rounded-xl p-5 max-w-md w-full space-y-4"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <HandCoins className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-text-primary">{t("borrow.fillRequest")}</h3>
                <p className="text-xs text-text-muted">{t("borrow.request")}{requestId}</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-bg-secondary flex items-center justify-center text-text-muted hover:text-text-primary transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Request Info */}
          <div className="bg-bg-secondary rounded-xl p-4 space-y-2.5">
            <div className="flex justify-between items-center text-sm">
              <span className="text-text-muted">{t("common.borrower")}</span>
              <span className="text-text-primary font-mono text-xs bg-bg-card px-2 py-1 rounded-lg">{shortenAddress(request.borrower)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-text-muted">{t("common.pending")}</span>
              <div className="flex items-center gap-1.5">
                <TokenIcon symbol="USDC" size="sm" />
                <span className="text-text-primary font-medium">{formatUsdc(remaining)} USDC</span>
              </div>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-text-muted">{t("common.collateral")}</span>
              <div className="flex items-center gap-1.5">
                {tokenInfo && <TokenIcon symbol={tokenInfo.symbol} size="sm" />}
                <span className="text-text-primary font-medium">{tokenInfo?.symbol || shortenAddress(request.collateralToken)}</span>
              </div>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-text-muted">{t("common.duration")}</span>
              <Badge variant="info">{t(`durations.${request.duration}`)}</Badge>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-text-muted">{t("common.interest")}</span>
              <Badge variant="success">{getInterestLabel(request.duration)}</Badge>
            </div>
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">{t("borrow.amountToLend")}</label>
            <div className="relative">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                max={maxAmount}
                placeholder="100"
                className="w-full bg-bg-secondary border border-border rounded-xl px-4 py-3 text-text-primary focus:border-accent-blue focus:outline-none transition-colors"
              />
              <button
                onClick={() => setAmount(maxAmount)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-purple-400 hover:text-purple-300 transition-colors bg-purple-500/10 px-2 py-1 rounded-lg"
              >
                MAX
              </button>
            </div>
            <p className="text-xs text-text-muted mt-1.5">{t("common.available")}: {maxAmount} USDC</p>
          </div>

          {/* Earnings Preview */}
          {amount && parseFloat(amount) > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="bg-bg-secondary rounded-xl p-4 space-y-2.5 border border-border"
            >
              <div className="flex items-center gap-1.5 text-xs text-text-muted mb-1">
                <TrendingUp className="w-3.5 h-3.5" />
                {t("borrow.estimatedEarnings")}
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-text-muted">{t("common.interest")} ({getInterestLabel(request.duration)})</span>
                <span className="text-accent-green font-medium">
                  +{(parseFloat(amount) * (request.duration === 0 ? 0.02 : request.duration === 1 ? 0.04 : 0.08)).toFixed(2)} USDC
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-text-muted">{t("borrow.platformFee")}</span>
                <span className="text-text-secondary">
                  -{(parseFloat(amount) * (request.duration === 0 ? 0.02 : request.duration === 1 ? 0.04 : 0.08) * 0.1).toFixed(2)} USDC
                </span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between items-center text-sm">
                <span className="text-text-secondary font-medium">{t("borrow.netEarnings")}</span>
                <span className="text-accent-green font-semibold">
                  +{(parseFloat(amount) * (request.duration === 0 ? 0.02 : request.duration === 1 ? 0.04 : 0.08) * 0.9).toFixed(2)} USDC
                </span>
              </div>
            </motion.div>
          )}

          {/* Action Button */}
          <Button
            onClick={handleFill}
            disabled={!amount || parseFloat(amount) <= 0 || step !== "idle"}
            loading={step === "approving" || step === "filling" || isFilling}
            size="lg"
            className="w-full bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-600/20"
          >
            {step === "approving"
              ? t("borrow.approvingUsdc")
              : step === "filling" || isFilling
              ? t("borrow.fillingRequest")
              : t("borrow.lendUsdc")}
          </Button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function BorrowRequestRow({ requestId, address }: { requestId: number; address?: `0x${string}` }) {
  const { t } = useTranslation();
  const { data: request, refetch } = useReadContract({
    address: CONTRACTS.OrderBook,
    abi: OrderBookABI,
    functionName: "getBorrowRequest",
    args: [BigInt(requestId)],
    query: { refetchInterval: 10000 },
  });

  const collateralToken = request?.collateralToken as `0x${string}` | undefined;

  const { data: contractBalance } = useReadContract({
    address: collateralToken,
    abi: ERC20ABI,
    functionName: "balanceOf",
    args: [CONTRACTS.OrderBook],
    query: { enabled: !!collateralToken },
  });

  const { cancel, isPending: isCancelling, isSuccess: cancelSuccess } = useCancelBorrowRequest();

  useEffect(() => {
    if (cancelSuccess) refetch();
  }, [cancelSuccess, refetch]);
  const [showModal, setShowModal] = useState(false);

  if (!request || Number(request.status) !== 0) return null;

  const remaining = request.requestedAmount - request.filledAmount;
  if (remaining === 0n) return null;

  // Hide stuck requests where OrderBook has no collateral
  if (contractBalance !== undefined && contractBalance === 0n) return null;

  const tokenInfo = COLLATERAL_TOKENS.find(
    (t) => t.address.toLowerCase() === request.collateralToken.toLowerCase()
  );

  const isOwner = address?.toLowerCase() === request.borrower.toLowerCase();
  const fillPercentage = Number(request.filledAmount) / Number(request.requestedAmount) * 100;

  return (
    <>
      <motion.tr
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: requestId * 0.05 }}
        className="border-b border-border/50 hover:bg-bg-secondary/50 transition-colors"
      >
        <td className="px-3 py-2.5 text-sm">
          <span className="text-text-muted font-mono">#{requestId}</span>
        </td>
        <td className="px-3 py-2.5 text-sm">
          <span className="font-mono text-text-secondary bg-bg-secondary px-2 py-1 rounded-lg text-xs">{shortenAddress(request.borrower)}</span>
        </td>
        <td className="px-3 py-2.5 text-sm text-right">
          <div className="flex items-center justify-end gap-2">
            <TokenIcon symbol="USDC" size="sm" />
            <div className="flex flex-col items-end">
              <span className="text-text-primary font-medium">{formatUsdc(remaining)}</span>
              {fillPercentage > 0 && (
                <span className="text-text-muted text-xs">{fillPercentage.toFixed(0)}% {t("borrow.filled")}</span>
              )}
            </div>
          </div>
        </td>
        <td className="px-3 py-2.5 text-sm">
          <div className="flex items-center gap-1.5">
            {tokenInfo && <TokenIcon symbol={tokenInfo.symbol} size="sm" />}
            <span className="text-text-primary">{tokenInfo?.symbol || shortenAddress(request.collateralToken)}</span>
          </div>
        </td>
        <td className="px-3 py-2.5 text-sm text-center">
          <Badge variant="info">{t(`durations.${Number(request.duration)}`)}</Badge>
        </td>
        <td className="px-3 py-2.5 text-sm text-center">
          {isOwner && request.filledAmount === 0n ? (
            <Button
              variant="danger"
              size="sm"
              onClick={() => cancel(BigInt(requestId))}
              disabled={isCancelling}
              loading={isCancelling}
            >
              {t("common.cancel")}
            </Button>
          ) : !isOwner && address ? (
            <Button
              size="sm"
              onClick={() => setShowModal(true)}
              className="bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-600/20"
            >
              {t("borrow.lendUsdc")}
            </Button>
          ) : !address ? (
            <span className="text-text-muted text-xs">{t("common.connectWallet")}</span>
          ) : (
            <span className="text-text-muted text-xs">-</span>
          )}
        </td>
      </motion.tr>
      {showModal && (
        <FillRequestModal
          requestId={requestId}
          request={{
            borrower: request.borrower,
            requestedAmount: request.requestedAmount,
            filledAmount: request.filledAmount,
            collateralToken: request.collateralToken,
            duration: Number(request.duration),
          }}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}

export default function BorrowPage() {
  const { t } = useTranslation();
  const { isConnected, address } = useAccount();
  const [amount, setAmount] = useState("");
  const [selectedToken, setSelectedToken] = useState<(typeof COLLATERAL_TOKENS)[number]>(COLLATERAL_TOKENS[0]);
  const [duration, setDuration] = useState(2);
  const [step, setStep] = useState<"idle" | "approving" | "creating">("idle");
  const [filterDuration, setFilterDuration] = useState<number | "all">("all");
  const [filterMinAmount, setFilterMinAmount] = useState("");
  const [sortBy, setSortBy] = useState<"amount" | "interest" | "newest">("newest");

  const amountUsdc = parseUnits(amount || "0", 6);

  // Auto-calculate required collateral from RiskEngine
  const { data: requiredCollateral } = useReadContract({
    address: CONTRACTS.RiskEngine,
    abi: RiskEngineABI,
    functionName: "calculateRequiredCollateral",
    args: [selectedToken.address, amountUsdc],
    query: { enabled: amountUsdc > 0n },
  });

  const collateralStr = requiredCollateral
    ? formatUnits(requiredCollateral, selectedToken.decimals)
    : "";

  const { data: requestCount, refetch: refetchCount } = useBorrowRequestCount();

  // Approve collateral token
  const { writeContract: approveWrite, data: approveHash, isPending: isApproving } = useWriteContract();
  const { isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveHash });

  const { createRequest, isPending: isCreating, isSuccess: createSuccess } = useCreateBorrowRequest();

  useEffect(() => {
    if (approveSuccess && step === "approving" && requiredCollateral) {
      setStep("creating");
      createRequest(amount, selectedToken.address, collateralStr, selectedToken.decimals, duration);
    }
  }, [approveSuccess]);

  useEffect(() => {
    if (createSuccess && step === "creating") {
      setStep("idle");
      setAmount("");
      refetchCount();
    }
  }, [createSuccess]);

  const handleCreateRequest = () => {
    if (!amount || !requiredCollateral || requiredCollateral === 0n) return;
    setStep("approving");
    approveWrite({
      address: selectedToken.address,
      abi: ERC20ABI,
      functionName: "approve",
      args: [CONTRACTS.OrderBook, requiredCollateral],
    });
  };

  const totalRequests = requestCount ? Number(requestCount) : 0;
  const requestIds = Array.from({ length: totalRequests }, (_, i) => i);
  const sortedRequestIds = sortBy === "newest" ? [...requestIds].reverse() : requestIds;

  const buttonText = () => {
    if (!isConnected) return t("common.connectWallet");
    if (step === "approving" || isApproving) return t("borrow.approvingCollateral");
    if (step === "creating" || isCreating) return t("borrow.creatingRequest");
    return t("borrow.createRequest");
  };

  const interestRate = duration === 0 ? 0.02 : duration === 1 ? 0.04 : 0.08;
  const isLoading = requestCount === undefined;

  // Health factor preview (collateral ratio is ~1.5x by default from RiskEngine)
  const healthFactorPreview = requiredCollateral && amountUsdc > 0n ? 1.5 : 0;

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-purple-500/10 flex items-center justify-center">
            <HandCoins className="w-4.5 h-4.5 text-purple-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">{t("borrow.title")}</h1>
            <p className="text-text-secondary text-sm">
              {t("borrow.subtitle")}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Create Borrow Request */}
      <GlassCard className="max-w-xl" padding="md">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
            <Plus className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-text-primary">{t("borrow.createTitle")}</h2>
            <p className="text-xs text-text-muted">{t("borrow.createSub")}</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Amount Input */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              <DollarSign className="w-3.5 h-3.5 inline mr-1" />
              {t("borrow.amountLabel")}
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="500"
              className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2.5 text-text-primary focus:border-accent-blue focus:outline-none transition-colors placeholder:text-text-muted"
            />
          </div>

          {/* Collateral Token Selection */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              <Coins className="w-3.5 h-3.5 inline mr-1" />
              {t("borrow.collateralToken")}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {COLLATERAL_TOKENS.map((token) => (
                <button
                  key={token.symbol}
                  onClick={() => setSelectedToken(token)}
                  className={clsx(
                    "flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 border",
                    selectedToken.symbol === token.symbol
                      ? "bg-purple-600 text-white border-purple-600 shadow-lg shadow-purple-600/20 scale-[1.02]"
                      : "bg-bg-secondary text-text-muted border-border hover:border-border-hover"
                  )}
                >
                  <TokenIcon symbol={token.symbol} size="sm" />
                  {token.symbol}
                </button>
              ))}
            </div>
          </div>

          {/* Duration Selection */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              <Clock className="w-3.5 h-3.5 inline mr-1" />
              {t("common.duration")}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2].map((d) => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  className={clsx(
                    "flex flex-col items-center gap-0.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 border",
                    duration === d
                      ? "bg-purple-600 text-white border-purple-600 shadow-lg shadow-purple-600/20 scale-[1.02]"
                      : "bg-bg-secondary text-text-muted border-border hover:border-border-hover"
                  )}
                >
                  <span>{t(`durations.${d}`)}</span>
                  <span className={clsx("text-xs", duration === d ? "text-white/70" : "text-text-muted")}>
                    {getInterestLabel(d)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Collateral & Cost Preview */}
          {amount && parseFloat(amount) > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="space-y-4"
            >
              {/* Collateral Preview Card */}
              <div className="bg-bg-secondary rounded-xl p-4 space-y-3 border border-border">
                <div className="flex items-center gap-1.5 text-xs text-text-muted mb-1">
                  <Shield className="w-3.5 h-3.5" />
                  {t("borrow.collateralCosts")}
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-text-muted">{t("borrow.requiredCollateral")}</span>
                  {requiredCollateral && requiredCollateral > 0n ? (
                    <div className="flex items-center gap-1.5">
                      <TokenIcon symbol={selectedToken.symbol} size="sm" />
                      <span className="text-accent-yellow font-medium">
                        {parseFloat(formatUnits(requiredCollateral, selectedToken.decimals)).toFixed(6)} {selectedToken.symbol}
                      </span>
                    </div>
                  ) : (
                    <Badge variant="danger">{t("borrow.tokenNotConfigured")}</Badge>
                  )}
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-text-muted">{t("borrow.maxInterest")} ({getInterestLabel(duration)})</span>
                  <span className="text-accent-yellow font-medium">
                    {(parseFloat(amount) * interestRate).toFixed(2)} USDC
                  </span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between items-center text-sm">
                  <span className="text-text-secondary font-medium flex items-center gap-1.5">
                    <Receipt className="w-3.5 h-3.5" />
                    {t("borrow.totalToPay")}
                  </span>
                  <span className="text-text-primary font-semibold">
                    {(parseFloat(amount) * (1 + interestRate)).toFixed(2)} USDC
                  </span>
                </div>
              </div>

              {/* Health Factor Preview + Risk Level */}
              {healthFactorPreview > 0 && (
                <div className="bg-bg-secondary rounded-xl p-4 border border-border space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-text-muted">
                      <TrendingUp className="w-3.5 h-3.5" />
                      {t("borrow.healthFactorEstimate")}
                    </div>
                    <div className={clsx(
                      "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
                      healthFactorPreview >= 1.5
                        ? "bg-accent-green/10 text-accent-green border-accent-green/20"
                        : healthFactorPreview >= 1.2
                        ? "bg-accent-yellow/10 text-accent-yellow border-accent-yellow/20"
                        : "bg-accent-red/10 text-accent-red border-accent-red/20"
                    )}>
                      <span className={clsx(
                        "w-1.5 h-1.5 rounded-full",
                        healthFactorPreview >= 1.5 ? "bg-accent-green" : healthFactorPreview >= 1.2 ? "bg-accent-yellow" : "bg-accent-red"
                      )} />
                      {healthFactorPreview >= 1.5 ? "Safe" : healthFactorPreview >= 1.2 ? "Medium" : "High Risk"}
                    </div>
                  </div>
                  <HealthBar value={healthFactorPreview} />
                </div>
              )}
            </motion.div>
          )}

          {/* Submit Button */}
          <Button
            onClick={handleCreateRequest}
            disabled={!isConnected || !amount || !requiredCollateral || requiredCollateral === 0n || step !== "idle"}
            loading={step === "approving" || isApproving || step === "creating" || isCreating}
            size="lg"
            className="w-full bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-600/20"
          >
            {buttonText()}
          </Button>
        </div>
      </GlassCard>

      {/* Active Borrow Requests */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-text-primary">{t("borrow.activeRequests")}</h2>
            {totalRequests > 0 && (
              <Badge variant="muted" size="md">{totalRequests}</Badge>
            )}
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-bg-secondary rounded-xl p-3 flex flex-wrap items-center gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-text-muted" />
            <span className="text-xs text-text-muted font-medium mr-1">{t("borrow.filterDuration")}</span>
            {([["all", t("common.all")], [0, "7d"], [1, "14d"], [2, "30d"]] as const).map(([value, label]) => (
              <button key={String(value)} onClick={() => setFilterDuration(value)}
                className={clsx("px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200",
                  filterDuration === value ? "bg-purple-600 text-white shadow-sm shadow-purple-600/20"
                    : "bg-bg-card text-text-muted hover:text-text-secondary border border-border"
                )}>{label}</button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-text-muted" />
            <input type="number" value={filterMinAmount} onChange={(e) => setFilterMinAmount(e.target.value)}
              placeholder="Min USDC"
              className="w-28 bg-bg-card border border-border rounded-full px-3 py-1.5 text-xs text-text-primary focus:border-purple-500 focus:outline-none transition-colors placeholder:text-text-muted" />
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <SlidersHorizontal className="w-4 h-4 text-text-muted" />
            <span className="text-xs text-text-muted font-medium mr-1">{t("borrow.sortBy")}</span>
            {([["newest", t("borrow.newest")], ["amount", t("borrow.highestAmount")]] as [typeof sortBy, string][]).map(([value, label]) => (
              <button key={value} onClick={() => setSortBy(value)}
                className={clsx("px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200",
                  sortBy === value ? "bg-purple-600 text-white shadow-sm shadow-purple-600/20"
                    : "bg-bg-card text-text-muted hover:text-text-secondary border border-border"
                )}>{label}</button>
            ))}
          </div>
        </div>

        <GlassCard padding="sm" hover={false}>
          {isLoading ? (
            <div className="p-4">
              <TableSkeleton rows={4} cols={6} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-text-muted uppercase tracking-wider">ID</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-text-muted uppercase tracking-wider">{t("borrow.tableBorrower")}</th>
                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-text-muted uppercase tracking-wider">{t("borrow.tableRequested")}</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-text-muted uppercase tracking-wider">{t("borrow.tableCollateral")}</th>
                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-text-muted uppercase tracking-wider">{t("borrow.tableDuration")}</th>
                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-text-muted uppercase tracking-wider">{t("borrow.tableAction")}</th>
                  </tr>
                </thead>
                <tbody>
                  {totalRequests === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8">
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-10 h-10 rounded-xl bg-bg-secondary flex items-center justify-center">
                            <HandCoins className="w-5 h-5 text-text-muted" />
                          </div>
                          <p className="text-text-muted text-sm">{t("borrow.noActiveRequests")}</p>
                          <p className="text-text-muted text-xs">{t("borrow.createFirstRequest")}</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    sortedRequestIds.map((id) => (
                      <BorrowRequestRow key={id} requestId={id} address={address} />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
