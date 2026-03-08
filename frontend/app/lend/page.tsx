"use client";

import { useState, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { motion, AnimatePresence } from "framer-motion";
import { CONTRACTS, COLLATERAL_TOKENS } from "@/lib/contracts";
import { OrderBookABI, ERC20ABI, RiskEngineABI } from "@/lib/abis";
import {
  useApproveUsdc,
  useCreateLendingOrder,
  useCancelLendingOrder,
  useLendingOrderCount,
} from "@/hooks/useOrderBook";
import { useTakeLoan } from "@/hooks/useLoanManager";
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
import { useTranslation } from "@/i18n/context";
import clsx from "clsx";
import {
  X,
  Plus,
  Wallet,
  Clock,
  TrendingUp,
  DollarSign,
  ArrowRight,
  Info,
  Landmark,
  Shield,
  Filter,
  SlidersHorizontal,
} from "lucide-react";

function TakeLoanModal({
  orderId,
  order,
  onClose,
}: {
  orderId: number;
  order: { lender: string; availableAmount: bigint; duration: number };
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [selectedToken, setSelectedToken] = useState<(typeof COLLATERAL_TOKENS)[number]>(COLLATERAL_TOKENS[0]);
  const [amount, setAmount] = useState(formatUnits(order.availableAmount, 6));
  const [step, setStep] = useState<"idle" | "approving" | "taking">("idle");

  const amountUsdc = parseUnits(amount || "0", 6);

  const { data: requiredCollateral } = useReadContract({
    address: CONTRACTS.RiskEngine,
    abi: RiskEngineABI,
    functionName: "calculateRequiredCollateral",
    args: [selectedToken.address, amountUsdc],
    query: { enabled: amountUsdc > 0n },
  });

  const { writeContract: approveCollateral, data: approveHash, isPending: isApproving } = useWriteContract();
  const { isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveHash });

  const { takeLoan, isPending: isTaking, isSuccess: takeLoanSuccess } = useTakeLoan();

  useEffect(() => {
    if (approveSuccess && step === "approving") {
      setStep("taking");
      takeLoan(
        BigInt(orderId),
        amount,
        selectedToken.address,
        formatUnits(requiredCollateral ?? 0n, selectedToken.decimals),
        selectedToken.decimals
      );
    }
  }, [approveSuccess]);

  useEffect(() => {
    if (takeLoanSuccess) {
      setStep("idle");
      onClose();
    }
  }, [takeLoanSuccess]);

  const handleTakeLoan = () => {
    if (!amount || !requiredCollateral) return;
    setStep("approving");
    approveCollateral({
      address: selectedToken.address,
      abi: ERC20ABI,
      functionName: "approve",
      args: [CONTRACTS.CollateralManager, requiredCollateral],
    });
  };

  const maxAmount = formatUnits(order.availableAmount, 6);

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
              <div className="w-8 h-8 rounded-lg bg-accent-blue/10 flex items-center justify-center">
                <ArrowRight className="w-4 h-4 text-accent-blue" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-text-primary">{t("lend.takeLoan")}</h3>
                <p className="text-xs text-text-muted">{t("lend.order")}{orderId}</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-bg-secondary flex items-center justify-center text-text-muted hover:text-text-primary transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Order Info */}
          <div className="bg-bg-secondary rounded-xl p-4 space-y-2.5">
            <div className="flex justify-between items-center text-sm">
              <span className="text-text-muted">{t("common.lender")}</span>
              <span className="text-text-primary font-mono text-xs bg-bg-card px-2 py-1 rounded-lg">{shortenAddress(order.lender)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-text-muted">{t("common.available")}</span>
              <div className="flex items-center gap-1.5">
                <TokenIcon symbol="USDC" size="sm" />
                <span className="text-text-primary font-medium">{formatUsdc(order.availableAmount)} USDC</span>
              </div>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-text-muted">{t("common.duration")}</span>
              <Badge variant="info">{t(`durations.${order.duration}`)}</Badge>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-text-muted">{t("common.interest")}</span>
              <Badge variant="success">{getInterestLabel(order.duration)}</Badge>
            </div>
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">{t("lend.usdcAmount")}</label>
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
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-accent-blue hover:text-blue-400 transition-colors bg-accent-blue/10 px-2 py-1 rounded-lg"
              >
                MAX
              </button>
            </div>
            <p className="text-xs text-text-muted mt-1.5">{t("common.available")}: {maxAmount} USDC</p>
          </div>

          {/* Collateral Token Selection */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">{t("lend.collateralToken")}</label>
            <div className="grid grid-cols-3 gap-2">
              {COLLATERAL_TOKENS.map((token) => (
                <button
                  key={token.symbol}
                  onClick={() => setSelectedToken(token)}
                  className={clsx(
                    "flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                    selectedToken.symbol === token.symbol
                      ? "bg-accent-blue text-white shadow-lg shadow-accent-blue/20 scale-[1.02]"
                      : "bg-bg-secondary text-text-muted hover:bg-bg-secondary/80 border border-border"
                  )}
                >
                  <TokenIcon symbol={token.symbol} size="sm" />
                  {token.symbol}
                </button>
              ))}
            </div>
          </div>

          {/* Cost Preview */}
          {amount && parseFloat(amount) > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="bg-bg-secondary rounded-xl p-4 space-y-2.5 border border-border"
            >
              <div className="flex justify-between items-center text-sm">
                <span className="text-text-muted flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" />
                  {t("lend.requiredCollateral")}
                </span>
                {requiredCollateral && requiredCollateral > 0n ? (
                  <span className="text-accent-yellow font-medium">
                    {parseFloat(formatUnits(requiredCollateral, selectedToken.decimals)).toFixed(6)} {selectedToken.symbol}
                  </span>
                ) : (
                  <span className="text-accent-red text-xs">{t("lend.tokenNotConfigured")}</span>
                )}
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-text-muted flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" />
                  {t("lend.maxInterest")}
                </span>
                <span className="text-accent-green font-medium">
                  {(parseFloat(amount) * (order.duration === 0 ? 0.02 : order.duration === 1 ? 0.04 : 0.08)).toFixed(2)} USDC
                </span>
              </div>
            </motion.div>
          )}

          {/* Action Button */}
          <Button
            onClick={handleTakeLoan}
            disabled={!amount || parseFloat(amount) <= 0 || !requiredCollateral || step !== "idle"}
            loading={step === "approving" || isApproving || step === "taking" || isTaking}
            size="lg"
            className="w-full"
          >
            {step === "approving" || isApproving
              ? t("lend.approvingCollateral")
              : step === "taking" || isTaking
              ? t("lend.takingLoan")
              : t("lend.takeLoan")}
          </Button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

type OrderFilters = {
  duration: number | "all";
  minAmount: string;
  sortBy: "amount" | "interest" | "newest";
};

function LendingOrderRow({ orderId, address, filters }: { orderId: number; address?: `0x${string}`; filters: OrderFilters }) {
  const { t } = useTranslation();
  const { data: order, refetch } = useReadContract({
    address: CONTRACTS.OrderBook,
    abi: OrderBookABI,
    functionName: "getLendingOrder",
    args: [BigInt(orderId)],
    query: { refetchInterval: 10000 },
  });

  const { cancel, isPending: isCancelling, isSuccess: cancelSuccess } = useCancelLendingOrder();

  useEffect(() => {
    if (cancelSuccess) refetch();
  }, [cancelSuccess, refetch]);
  const [showModal, setShowModal] = useState(false);

  if (!order || Number(order.status) !== 0) return null;
  if (Number(order.availableAmount) === 0) return null;

  // Apply filters
  if (filters.duration !== "all" && Number(order.duration) !== filters.duration) return null;
  if (filters.minAmount && Number(order.availableAmount) / 1e6 < parseFloat(filters.minAmount)) return null;

  const isOwner = address?.toLowerCase() === order.lender.toLowerCase();

  return (
    <>
      <motion.tr
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: orderId * 0.05 }}
        className="border-b border-border/50 hover:bg-bg-secondary/50 transition-colors"
      >
        <td className="px-3 py-2.5 text-sm">
          <span className="text-text-muted font-mono">#{orderId}</span>
        </td>
        <td className="px-3 py-2.5 text-sm">
          <span className="font-mono text-text-secondary bg-bg-secondary px-2 py-1 rounded-lg text-xs">{shortenAddress(order.lender)}</span>
        </td>
        <td className="px-3 py-2.5 text-sm text-right">
          <div className="flex items-center justify-end gap-1.5">
            <TokenIcon symbol="USDC" size="sm" />
            <span className="text-text-primary font-medium">{formatUsdc(order.availableAmount)}</span>
          </div>
        </td>
        <td className="px-3 py-2.5 text-sm text-center">
          <Badge variant="info">{t(`durations.${Number(order.duration)}`)}</Badge>
        </td>
        <td className="px-3 py-2.5 text-sm text-center">
          <Badge variant="success">{getInterestLabel(Number(order.duration))}</Badge>
        </td>
        <td className="px-3 py-2.5 text-sm text-center">
          {isOwner ? (
            <Button
              variant="danger"
              size="sm"
              onClick={() => cancel(BigInt(orderId))}
              disabled={isCancelling}
              loading={isCancelling}
            >
              {t("common.cancel")}
            </Button>
          ) : address ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowModal(true)}
            >
              {t("lend.takeLoan")}
            </Button>
          ) : (
            <span className="text-text-muted text-xs">{t("common.connectWallet")}</span>
          )}
        </td>
      </motion.tr>
      {showModal && (
        <TakeLoanModal
          orderId={orderId}
          order={{
            lender: order.lender,
            availableAmount: order.availableAmount,
            duration: Number(order.duration),
          }}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}

export default function LendPage() {
  const { t } = useTranslation();
  const { isConnected, address } = useAccount();
  const [amount, setAmount] = useState("");
  const [duration, setDuration] = useState(0);
  const [step, setStep] = useState<"idle" | "approving" | "creating">("idle");

  // Filter & sort state
  const [filterDuration, setFilterDuration] = useState<number | "all">("all");
  const [filterMinAmount, setFilterMinAmount] = useState("");
  const [sortBy, setSortBy] = useState<"amount" | "interest" | "newest">("newest");

  const { data: orderCount, refetch: refetchCount } = useLendingOrderCount();
  const { approve, isPending: isApproving, isSuccess: approveSuccess } = useApproveUsdc();
  const { createOrder, isPending: isCreating, isSuccess: createSuccess } = useCreateLendingOrder();

  const { data: usdcBalance } = useReadContract({
    address: CONTRACTS.USDC,
    abi: ERC20ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  useEffect(() => {
    if (approveSuccess && step === "approving") {
      setStep("creating");
      createOrder(amount, duration);
    }
  }, [approveSuccess]);

  useEffect(() => {
    if (createSuccess && step === "creating") {
      setStep("idle");
      setAmount("");
      refetchCount();
    }
  }, [createSuccess]);

  const handleCreateOrder = () => {
    if (!amount || parseFloat(amount) <= 0) return;
    setStep("approving");
    approve(CONTRACTS.OrderBook, amount);
  };

  const totalOrders = orderCount ? Number(orderCount) : 0;
  const orderIds = Array.from({ length: totalOrders }, (_, i) => i);

  const buttonText = () => {
    if (!isConnected) return t("common.connectWallet");
    if (step === "approving" || isApproving) return t("lend.approvingUsdc");
    if (step === "creating" || isCreating) return t("lend.creatingOffer");
    return t("lend.createOffer");
  };

  const isLoading = orderCount === undefined;

  const filters: OrderFilters = {
    duration: filterDuration,
    minAmount: filterMinAmount,
    sortBy,
  };

  // Sort order IDs (newest first by default, reverse for oldest)
  const sortedOrderIds = sortBy === "newest" ? [...orderIds].reverse() : orderIds;

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-accent-blue/10 flex items-center justify-center">
            <Landmark className="w-4.5 h-4.5 text-accent-blue" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">{t("lend.title")}</h1>
            <p className="text-text-secondary text-sm">
              {t("lend.subtitle")}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Create Lending Order */}
      <GlassCard className="max-w-xl" padding="md">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-lg bg-accent-blue/10 flex items-center justify-center">
            <Plus className="w-4 h-4 text-accent-blue" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-text-primary">{t("lend.createTitle")}</h2>
            <p className="text-xs text-text-muted">{t("lend.createSub")}</p>
          </div>
        </div>

        {address && usdcBalance !== undefined && (
          <div className="flex items-center gap-2 mb-4 bg-bg-secondary rounded-lg px-3 py-2.5 border border-border">
            <Wallet className="w-4 h-4 text-text-muted" />
            <span className="text-sm text-text-secondary">Balance:</span>
            <div className="flex items-center gap-1.5 ml-auto">
              <TokenIcon symbol="USDC" size="sm" />
              <span className="text-sm font-medium text-text-primary">{formatUsdc(usdcBalance)} USDC</span>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {/* Amount Input */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              <DollarSign className="w-3.5 h-3.5 inline mr-1" />
              {t("lend.amountLabel")}
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="1000"
              className="w-full bg-bg-secondary border border-border rounded-xl px-4 py-3 text-text-primary focus:border-accent-blue focus:outline-none transition-colors placeholder:text-text-muted"
            />
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
                      ? "bg-accent-blue text-white border-accent-blue shadow-lg shadow-accent-blue/20 scale-[1.02]"
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

          {/* Earnings Preview */}
          {amount && parseFloat(amount) > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="bg-bg-secondary rounded-lg p-3 space-y-2.5 border border-border"
            >
              <div className="flex items-center gap-1.5 text-xs text-text-muted mb-1">
                <Info className="w-3.5 h-3.5" />
                {t("lend.offerSummary")}
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-text-muted">{t("lend.maxInterest")}</span>
                <span className="text-accent-green font-medium">
                  +{(parseFloat(amount) * (duration === 0 ? 0.02 : duration === 1 ? 0.04 : 0.08)).toFixed(2)} USDC
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-text-muted">{t("lend.platformFee")}</span>
                <span className="text-text-secondary">
                  -{(parseFloat(amount) * (duration === 0 ? 0.02 : duration === 1 ? 0.04 : 0.08) * 0.1).toFixed(2)} USDC
                </span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between items-center text-sm">
                <span className="text-text-secondary font-medium">{t("lend.netEarnings")}</span>
                <span className="text-accent-green font-semibold">
                  +{(parseFloat(amount) * (duration === 0 ? 0.02 : duration === 1 ? 0.04 : 0.08) * 0.9).toFixed(2)} USDC
                </span>
              </div>
            </motion.div>
          )}

          {/* Submit Button */}
          <Button
            onClick={handleCreateOrder}
            disabled={!isConnected || !amount || step !== "idle"}
            loading={step === "approving" || isApproving || step === "creating" || isCreating}
            size="lg"
            className="w-full"
          >
            {buttonText()}
          </Button>
        </div>
      </GlassCard>

      {/* Active Lending Orders */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-text-primary">{t("lend.activeOffers")}</h2>
            {totalOrders > 0 && (
              <Badge variant="muted" size="md">{totalOrders}</Badge>
            )}
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-bg-secondary rounded-xl p-3 flex flex-wrap items-center gap-3 mb-4">
          {/* Duration Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-text-muted" />
            <span className="text-xs text-text-muted font-medium mr-1">{t("lend.filterDuration")}</span>
            {([["all", t("common.all")], [0, "7d"], [1, "14d"], [2, "30d"]] as const).map(([value, label]) => (
              <button
                key={String(value)}
                onClick={() => setFilterDuration(value)}
                className={clsx(
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200",
                  filterDuration === value
                    ? "bg-accent-blue text-white shadow-sm shadow-accent-blue/20"
                    : "bg-bg-card text-text-muted hover:text-text-secondary border border-border"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Min Amount Filter */}
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-text-muted" />
            <input
              type="number"
              value={filterMinAmount}
              onChange={(e) => setFilterMinAmount(e.target.value)}
              placeholder="Min USDC"
              className="w-28 bg-bg-card border border-border rounded-full px-3 py-1.5 text-xs text-text-primary focus:border-accent-blue focus:outline-none transition-colors placeholder:text-text-muted"
            />
          </div>

          {/* Sort By */}
          <div className="flex items-center gap-2 ml-auto">
            <SlidersHorizontal className="w-4 h-4 text-text-muted" />
            <span className="text-xs text-text-muted font-medium mr-1">{t("lend.sortBy")}</span>
            {([["newest", t("lend.newest")], ["amount", t("lend.highestAmount")], ["interest", t("lend.lowestInterest")]] as [typeof sortBy, string][]).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setSortBy(value)}
                className={clsx(
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200",
                  sortBy === value
                    ? "bg-accent-blue text-white shadow-sm shadow-accent-blue/20"
                    : "bg-bg-card text-text-muted hover:text-text-secondary border border-border"
                )}
              >
                {label}
              </button>
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
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-text-muted uppercase tracking-wider">{t("lend.tableId")}</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-text-muted uppercase tracking-wider">{t("lend.tableLender")}</th>
                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-text-muted uppercase tracking-wider">{t("lend.tableAvailable")}</th>
                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-text-muted uppercase tracking-wider">{t("lend.tableDuration")}</th>
                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-text-muted uppercase tracking-wider">{t("lend.tableInterest")}</th>
                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-text-muted uppercase tracking-wider">{t("lend.tableAction")}</th>
                  </tr>
                </thead>
                <tbody>
                  {totalOrders === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8">
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-10 h-10 rounded-xl bg-bg-secondary flex items-center justify-center">
                            <Landmark className="w-5 h-5 text-text-muted" />
                          </div>
                          <p className="text-text-muted text-sm">{t("lend.noActiveOffers")}</p>
                          <p className="text-text-muted text-xs">{t("lend.createFirstOffer")}</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    sortedOrderIds.map((id) => (
                      <LendingOrderRow key={id} orderId={id} address={address} filters={filters} />
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
