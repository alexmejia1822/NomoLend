"use client";

import { useAccount, useReadContract } from "wagmi";
import { CONTRACTS } from "@/lib/contracts";
import { LoanManagerABI, OrderBookABI } from "@/lib/abis";
import {
  useBorrowerLoans,
  useLenderLoans,
  useRepayLoan,
} from "@/hooks/useLoanManager";
import {
  useUserLendingOrders,
  useUserBorrowRequests,
  useCancelLendingOrder,
  useCancelBorrowRequest,
  useApproveUsdc,
} from "@/hooks/useOrderBook";
import { shortenAddress, formatUsdc } from "@/lib/utils";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { HealthBar } from "@/components/ui/HealthBar";
import { useTranslation } from "@/i18n/context";
import clsx from "clsx";
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  FileText,
  BookOpen,
  Send,
  XCircle,
  DollarSign,
  Shield,
} from "lucide-react";

/* ─── Loan Card ─── */
function LoanCard({ loanId, isBorrower }: { loanId: bigint; isBorrower: boolean }) {
  const { t } = useTranslation();

  const { data: loan } = useReadContract({
    address: CONTRACTS.LoanManager,
    abi: LoanManagerABI,
    functionName: "getLoan",
    args: [loanId],
  });

  const { data: debt } = useReadContract({
    address: CONTRACTS.LoanManager,
    abi: LoanManagerABI,
    functionName: "getCurrentDebt",
    args: [loanId],
    query: { enabled: loan?.status === 0 },
  });

  const { data: healthFactor } = useReadContract({
    address: CONTRACTS.LoanManager,
    abi: LoanManagerABI,
    functionName: "getLoanHealthFactor",
    args: [loanId],
    query: { enabled: loan?.status === 0 },
  });

  const [step, setStep] = useState<"idle" | "approving" | "repaying">("idle");
  const { approve, isSuccess: approveOk } = useApproveUsdc();
  const { repay, isSuccess: repayOk } = useRepayLoan();

  useEffect(() => {
    if (approveOk && step === "approving") {
      setStep("repaying");
      repay(loanId);
    }
  }, [approveOk]);

  useEffect(() => {
    if (repayOk) setStep("idle");
  }, [repayOk]);

  if (!loan) return null;

  const status = t(`loanStatus.${Number(loan.status)}`) || t("common.unknown");
  const isActive = Number(loan.status) === 0;

  const handleRepay = () => {
    if (!debt) return;
    setStep("approving");
    const totalDebtStr = (Number(debt[0]) / 1e6).toFixed(6);
    approve(CONTRACTS.LoanManager, totalDebtStr);
  };

  const hfValue = healthFactor ? Number(healthFactor) / 10000 : 0;

  const statusVariant =
    Number(loan.status) === 0
      ? "success"
      : Number(loan.status) === 1
      ? "info"
      : Number(loan.status) === 2
      ? "danger"
      : "muted";

  /* Time remaining estimate */
  const endTime = loan.startTimestamp > 0n
    ? Number(loan.startTimestamp) +
      (Number(loan.duration) === 0 ? 7 * 86400 : Number(loan.duration) === 1 ? 14 * 86400 : 30 * 86400)
    : 0;
  const now = Math.floor(Date.now() / 1000);
  const remaining = endTime > now ? endTime - now : 0;
  const daysLeft = Math.floor(remaining / 86400);
  const hoursLeft = Math.floor((remaining % 86400) / 3600);

  const durationDays = Number(loan.duration) === 0 ? 7 : Number(loan.duration) === 1 ? 14 : 30;
  const totalDuration = durationDays * 86400;
  const elapsed = now - Number(loan.startTimestamp);
  const progressPct = Math.min(Math.max((elapsed / totalDuration) * 100, 0), 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl bg-bg-card border border-border hover:border-border-hover transition-all duration-300 p-4"
    >
      {/* Top row: ID + status */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-text-muted text-xs font-mono">{t("myLoans.loanCard")} #{Number(loanId)}</span>
        <Badge variant={statusVariant}>{status}</Badge>
      </div>

      {/* Principal */}
      <div className="mb-3">
        <p className="text-text-secondary text-[11px] uppercase tracking-wider mb-0.5">{t("myLoans.principal")}</p>
        <p className="text-xl font-bold text-text-primary">{formatUsdc(loan.principal)} <span className="text-xs text-text-muted">USDC</span></p>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="rounded-lg bg-bg-secondary/50 p-2.5">
          <p className="text-text-muted text-[11px] uppercase tracking-wider mb-1">
            {isBorrower ? t("common.lender") : t("common.borrower")}
          </p>
          <p className="text-text-primary text-sm font-mono">
            {shortenAddress(isBorrower ? loan.lender : loan.borrower)}
          </p>
        </div>
        <div className="rounded-lg bg-bg-secondary/50 p-2.5">
          <p className="text-text-muted text-[11px] uppercase tracking-wider mb-1">{t("common.collateral")}</p>
          <p className="text-text-primary text-sm font-mono">{shortenAddress(loan.collateralToken)}</p>
        </div>
        <div className="rounded-lg bg-bg-secondary/50 p-2.5">
          <p className="text-text-muted text-[11px] uppercase tracking-wider mb-1">{t("common.duration")}</p>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-text-muted" />
            <p className="text-text-primary text-sm">{t(`durations.${Number(loan.duration)}`)}</p>
          </div>
        </div>
        <div className="rounded-lg bg-bg-secondary/50 p-2.5">
          <p className="text-text-muted text-[11px] uppercase tracking-wider mb-1">{t("myLoans.timeRemaining")}</p>
          <p className="text-text-primary text-sm">
            {isActive && remaining > 0
              ? `${daysLeft}d ${hoursLeft}h`
              : isActive
              ? t("myLoans.expired")
              : "-"}
          </p>
        </div>
      </div>

      {/* Duration Progress Bar */}
      {isActive && loan.startTimestamp > 0n && (
        <div className="mt-1.5 mb-3">
          <div className="w-full h-2 rounded-full bg-bg-secondary overflow-hidden">
            <div
              className={clsx(
                "h-full rounded-full transition-all duration-500",
                progressPct > 90 ? "bg-accent-red" : progressPct > 70 ? "bg-accent-yellow" : "bg-accent-blue"
              )}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-text-muted">{t("myLoans.start")}</span>
            <span className="text-[10px] text-text-muted">{Math.round(progressPct)}% {t("myLoans.elapsed")}</span>
            <span className="text-[10px] text-text-muted">{t("myLoans.end")}</span>
          </div>
        </div>
      )}

      {/* Health Factor Bar */}
      {isActive && healthFactor ? (
        <div className="mb-3">
          <HealthBar value={hfValue} />
        </div>
      ) : null}

      {/* Action area */}
      <div className="pt-3 border-t border-border">
        {isBorrower && isActive ? (
          <Button
            variant="primary"
            size="sm"
            className="w-full"
            loading={step !== "idle"}
            onClick={handleRepay}
          >
            {step === "approving" ? t("myLoans.approving") : step === "repaying" ? t("myLoans.paying") : t("myLoans.repayLoan")}
          </Button>
        ) : isActive ? (
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-muted">{t("myLoans.currentDebt")}</span>
            <span className="text-text-primary font-medium">
              {debt ? formatUsdc(debt[0]) : "..."} USDC
            </span>
          </div>
        ) : loan.interestPaid > 0n ? (
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-muted">{t("myLoans.interestPaid")}</span>
            <span className="text-accent-green font-medium">{formatUsdc(loan.interestPaid)} USDC</span>
          </div>
        ) : (
          <p className="text-text-muted text-sm text-center">{t("myLoans.noAdditionalData")}</p>
        )}
      </div>
    </motion.div>
  );
}

/* ─── Order Card ─── */
function OrderCard({
  orderId,
  type,
}: {
  orderId: bigint;
  type: "lending" | "borrow";
}) {
  const { t } = useTranslation();

  const { data: lendingOrder } = useReadContract({
    address: CONTRACTS.OrderBook,
    abi: OrderBookABI,
    functionName: "getLendingOrder",
    args: [orderId],
    query: { enabled: type === "lending" },
  });

  const { data: borrowRequest } = useReadContract({
    address: CONTRACTS.OrderBook,
    abi: OrderBookABI,
    functionName: "getBorrowRequest",
    args: [orderId],
    query: { enabled: type === "borrow" },
  });

  const { cancel: cancelLend, isPending: isCancellingLend } = useCancelLendingOrder();
  const { cancel: cancelBorrow, isPending: isCancellingBorrow } = useCancelBorrowRequest();

  const borrowCollateralToken = type === "borrow" && borrowRequest
    ? (borrowRequest as unknown as { collateralToken: string }).collateralToken as `0x${string}`
    : undefined;
  const { data: obBalance } = useReadContract({
    address: borrowCollateralToken,
    abi: [{ inputs: [{ name: "account", type: "address" }], name: "balanceOf", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" }] as const,
    functionName: "balanceOf",
    args: [CONTRACTS.OrderBook],
    query: { enabled: !!borrowCollateralToken },
  });

  const order = type === "lending" ? lendingOrder : borrowRequest;
  if (!order) return null;

  // Hide stuck borrow requests where OrderBook has no collateral
  if (type === "borrow" && obBalance !== undefined && obBalance === 0n) return null;

  const status = t(`orderStatus.${Number(order.status)}`) || t("common.unknown");
  const isOpen = Number(order.status) === 0;
  const amount = type === "lending"
    ? (order as { availableAmount: bigint }).availableAmount
    : (order as { requestedAmount: bigint }).requestedAmount;

  const statusVariant = isOpen ? "success" : Number(order.status) === 1 ? "info" : "muted";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl bg-bg-card border border-border hover:border-border-hover transition-all duration-300 p-3"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={clsx(
            "w-8 h-8 rounded-lg flex items-center justify-center",
            type === "lending" ? "bg-accent-blue/10" : "bg-accent-purple/10"
          )}>
            {type === "lending" ? (
              <ArrowUpRight className={clsx("w-4 h-4", "text-accent-blue")} />
            ) : (
              <ArrowDownLeft className="w-4 h-4 text-accent-purple" />
            )}
          </div>
          <span className="text-text-muted text-xs font-mono">#{Number(orderId)}</span>
        </div>
        <Badge variant={statusVariant} size="sm">{status}</Badge>
      </div>

      <p className="text-base font-bold text-text-primary mb-0.5">
        {formatUsdc(amount)} <span className="text-xs text-text-muted">USDC</span>
      </p>
      <p className="text-text-muted text-xs mb-2">
        {type === "lending" ? t("myLoans.lendingOrder") : t("myLoans.borrowRequest")}
      </p>

      {isOpen && (
        <Button
          variant="danger"
          size="sm"
          className="w-full"
          loading={isCancellingLend || isCancellingBorrow}
          onClick={() =>
            type === "lending" ? cancelLend(orderId) : cancelBorrow(orderId)
          }
        >
          <XCircle className="w-3.5 h-3.5 mr-1.5" />
          {t("common.cancel")}
        </Button>
      )}
    </motion.div>
  );
}

/* ─── Skeleton loaders ─── */
function LoanCardSkeleton() {
  return (
    <div className="rounded-xl bg-bg-card border border-border p-4 animate-pulse">
      <div className="flex justify-between mb-3">
        <div className="h-3 w-20 bg-bg-secondary rounded" />
        <div className="h-5 w-14 bg-bg-secondary rounded-full" />
      </div>
      <div className="h-7 w-36 bg-bg-secondary rounded mb-3" />
      <div className="grid grid-cols-2 gap-2 mb-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-14 bg-bg-secondary rounded-xl" />
        ))}
      </div>
      <div className="h-2.5 w-full bg-bg-secondary rounded-full mb-3" />
      <div className="h-8 w-full bg-bg-secondary rounded-lg" />
    </div>
  );
}

function OrderCardSkeleton() {
  return (
    <div className="rounded-xl bg-bg-card border border-border p-3 animate-pulse">
      <div className="flex justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-bg-secondary rounded-lg" />
          <div className="h-3 w-10 bg-bg-secondary rounded" />
        </div>
        <div className="h-5 w-14 bg-bg-secondary rounded-full" />
      </div>
      <div className="h-6 w-28 bg-bg-secondary rounded mb-1" />
      <div className="h-3 w-24 bg-bg-secondary rounded mb-3" />
      <div className="h-8 w-full bg-bg-secondary rounded-xl" />
    </div>
  );
}

/* ─── Empty state ─── */
function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center py-8 text-center"
    >
      <div className="w-10 h-10 rounded-xl bg-bg-secondary flex items-center justify-center mb-3">
        <Icon className="w-6 h-6 text-text-muted" />
      </div>
      <p className="text-text-secondary font-medium mb-1">{title}</p>
      <p className="text-text-muted text-sm max-w-xs">{description}</p>
    </motion.div>
  );
}

/* ─── Main page ─── */
export default function MyLoansPage() {
  const { t } = useTranslation();
  const { address, isConnected } = useAccount();

  const { data: borrowerLoanIds } = useBorrowerLoans(address);
  const { data: lenderLoanIds } = useLenderLoans(address);
  const { data: userLendingOrderIds } = useUserLendingOrders(address);
  const { data: userBorrowRequestIds } = useUserBorrowRequests(address);

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-14 h-14 rounded-2xl bg-accent-blue/10 border border-accent-blue/20 flex items-center justify-center mb-4"
        >
          <Wallet className="w-6 h-6 text-accent-blue" />
        </motion.div>
        <h1 className="text-3xl font-bold text-text-primary mb-2">{t("myLoans.title")}</h1>
        <p className="text-text-muted max-w-sm">
          {t("myLoans.connectPrompt")}
        </p>
      </div>
    );
  }

  const isLoadingLoans = !borrowerLoanIds && !lenderLoanIds;
  const isLoadingOrders = !userLendingOrderIds && !userBorrowRequestIds;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-xl font-bold text-text-primary">{t("myLoans.title")}</h1>
        <p className="text-text-secondary text-sm">
          {t("myLoans.subtitle")}
        </p>
      </motion.div>

      {/* Borrower Loans */}
      <section>
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-9 h-9 rounded-xl bg-accent-red/10 flex items-center justify-center">
            <ArrowDownLeft className="w-4.5 h-4.5 text-accent-red" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">
              {t("myLoans.borrowerLoans")}
              {borrowerLoanIds && borrowerLoanIds.length > 0 && (
                <Badge variant="muted" size="sm" >{borrowerLoanIds.length}</Badge>
              )}
            </h2>
            <p className="text-text-muted text-xs">{t("myLoans.borrowerLoansSub")}</p>
          </div>
        </div>

        {isLoadingLoans ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => <LoanCardSkeleton key={i} />)}
          </div>
        ) : !borrowerLoanIds || borrowerLoanIds.length === 0 ? (
          <GlassCard hover={false}>
            <EmptyState
              icon={FileText}
              title={t("myLoans.noBorrowerLoans")}
              description={t("myLoans.noBorrowerLoansSub")}
            />
          </GlassCard>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {borrowerLoanIds.map((id) => (
              <LoanCard key={Number(id)} loanId={id} isBorrower={true} />
            ))}
          </div>
        )}
      </section>

      {/* Lender Loans */}
      <section>
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-9 h-9 rounded-xl bg-accent-green/10 flex items-center justify-center">
            <ArrowUpRight className="w-4.5 h-4.5 text-accent-green" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">
              {t("myLoans.lenderLoans")}
              {lenderLoanIds && lenderLoanIds.length > 0 && (
                <Badge variant="muted" size="sm" >{lenderLoanIds.length}</Badge>
              )}
            </h2>
            <p className="text-text-muted text-xs">{t("myLoans.lenderLoansSub")}</p>
          </div>
        </div>

        {isLoadingLoans ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => <LoanCardSkeleton key={i} />)}
          </div>
        ) : !lenderLoanIds || lenderLoanIds.length === 0 ? (
          <GlassCard hover={false}>
            <EmptyState
              icon={Send}
              title={t("myLoans.noLenderLoans")}
              description={t("myLoans.noLenderLoansSub")}
            />
          </GlassCard>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {lenderLoanIds.map((id) => (
              <LoanCard key={Number(id)} loanId={id} isBorrower={false} />
            ))}
          </div>
        )}
      </section>

      {/* Orders / Requests */}
      <section>
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-9 h-9 rounded-xl bg-accent-blue/10 flex items-center justify-center">
            <BookOpen className="w-4.5 h-4.5 text-accent-blue" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">{t("myLoans.myOrders")}</h2>
            <p className="text-text-muted text-xs">{t("myLoans.myOrdersSub")}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Lending Orders */}
          <GlassCard>
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="w-4 h-4 text-accent-blue" />
              <h3 className="font-semibold text-text-primary">{t("myLoans.lendingOffers")}</h3>
              {userLendingOrderIds && userLendingOrderIds.length > 0 && (
                <Badge variant="info" size="sm">{userLendingOrderIds.length}</Badge>
              )}
            </div>

            {isLoadingOrders ? (
              <div className="space-y-3">
                {[...Array(2)].map((_, i) => <OrderCardSkeleton key={i} />)}
              </div>
            ) : !userLendingOrderIds || userLendingOrderIds.length === 0 ? (
              <EmptyState
                icon={DollarSign}
                title={t("myLoans.noOffers")}
                description={t("myLoans.noOffersSub")}
              />
            ) : (
              <div className="space-y-3">
                {userLendingOrderIds.map((id) => (
                  <OrderCard key={Number(id)} orderId={id} type="lending" />
                ))}
              </div>
            )}
          </GlassCard>

          {/* Borrow Requests */}
          <GlassCard>
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-4 h-4 text-accent-purple" />
              <h3 className="font-semibold text-text-primary">{t("myLoans.borrowRequests")}</h3>
              {userBorrowRequestIds && userBorrowRequestIds.length > 0 && (
                <Badge variant="warning" size="sm">{userBorrowRequestIds.length}</Badge>
              )}
            </div>

            {isLoadingOrders ? (
              <div className="space-y-3">
                {[...Array(2)].map((_, i) => <OrderCardSkeleton key={i} />)}
              </div>
            ) : !userBorrowRequestIds || userBorrowRequestIds.length === 0 ? (
              <EmptyState
                icon={Shield}
                title={t("myLoans.noRequests")}
                description={t("myLoans.noRequestsSub")}
              />
            ) : (
              <div className="space-y-3">
                {userBorrowRequestIds.map((id) => (
                  <OrderCard key={Number(id)} orderId={id} type="borrow" />
                ))}
              </div>
            )}
          </GlassCard>
        </div>
      </section>
    </div>
  );
}
