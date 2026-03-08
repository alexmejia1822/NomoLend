"use client";

import { useReadContract } from "wagmi";
import { CONTRACTS } from "@/lib/contracts";
import { LoanManagerABI, LoanManagerNextIdABI } from "@/lib/abis";
import { formatUsdc, shortenAddress } from "@/lib/utils";
import { useTranslation } from "@/i18n/context";
import { GlassCard } from "./GlassCard";
import { Badge } from "./Badge";
import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownLeft, Zap, Clock } from "lucide-react";
import clsx from "clsx";

type ActivityFeedProps = {
  maxItems?: number;
};

type LoanData = {
  loanId: bigint;
  lender: string;
  borrower: string;
  principal: bigint;
  collateralToken: string;
  collateralAmount: bigint;
  startTimestamp: bigint;
  duration: number;
  status: number;
  interestPaid: bigint;
  repaidAt: bigint;
};

function getTimeAgo(timestamp: bigint, t: (key: string) => string): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - Number(timestamp);

  if (diff < 60) return t("activity.secondsAgo");
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return `${Math.floor(diff / 604800)}w`;
}

function getActivityIcon(status: number) {
  switch (status) {
    case 0: // Active - loan created
      return { icon: ArrowUpRight, color: "text-accent-green", bg: "bg-accent-green/10" };
    case 1: // Repaid
      return { icon: ArrowDownLeft, color: "text-accent-blue", bg: "bg-accent-blue/10" };
    case 2: // Liquidated
      return { icon: Zap, color: "text-accent-red", bg: "bg-accent-red/10" };
    default: // Expired or unknown
      return { icon: Clock, color: "text-text-muted", bg: "bg-bg-secondary" };
  }
}

function getActivityDescription(loan: LoanData, t: (key: string) => string): string {
  const borrower = shortenAddress(loan.borrower);
  const lender = shortenAddress(loan.lender);

  switch (loan.status) {
    case 0:
      return `${borrower} ${t("activity.tookLoan")} ${lender}`;
    case 1:
      return `${borrower} ${t("activity.repaidLoan")} ${lender}`;
    case 2:
      return t("activity.liquidated").replace("{borrower}", borrower);
    case 3:
      return t("activity.expired").replace("{borrower}", borrower);
    default:
      return `${t("activity.loanActivity")} #${loan.loanId.toString()}`;
  }
}

function getStatusVariant(status: number): "success" | "warning" | "danger" | "info" | "muted" {
  switch (status) {
    case 0: return "success";
    case 1: return "info";
    case 2: return "danger";
    default: return "muted";
  }
}

function LoanActivityItem({ loanId }: { loanId: number }) {
  const { t } = useTranslation();
  const { data: loan } = useReadContract({
    address: CONTRACTS.LoanManager,
    abi: LoanManagerABI,
    functionName: "getLoan",
    args: [BigInt(loanId)],
  });

  if (!loan) return null;

  const loanData = loan as unknown as LoanData;
  const activity = getActivityIcon(loanData.status);
  const Icon = activity.icon;
  const timestamp = loanData.status === 1 && loanData.repaidAt > 0n
    ? loanData.repaidAt
    : loanData.startTimestamp;

  if (loanData.startTimestamp === 0n) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-3 py-3 border-b border-border last:border-b-0"
    >
      <div className={clsx("flex items-center justify-center w-9 h-9 rounded-xl shrink-0", activity.bg)}>
        <Icon className={clsx("w-4 h-4", activity.color)} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm text-text-primary truncate">
          {getActivityDescription(loanData, t)}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-text-muted">{getTimeAgo(timestamp, t)}</span>
          <Badge variant={getStatusVariant(loanData.status)} size="sm">
            {t(`loanStatus.${loanData.status}`)}
          </Badge>
        </div>
      </div>

      <div className="text-right shrink-0">
        <p className="text-sm font-medium text-text-primary">
          ${formatUsdc(loanData.principal)}
        </p>
        <p className="text-xs text-text-muted">USDC</p>
      </div>
    </motion.div>
  );
}

export function ActivityFeed({ maxItems = 10 }: ActivityFeedProps) {
  const { t } = useTranslation();
  const { data: nextId, isLoading } = useReadContract({
    address: CONTRACTS.LoanManager,
    abi: LoanManagerNextIdABI,
    functionName: "nextLoanId",
  });

  const totalLoans = nextId ? Number(nextId) : 0;
  const loanIds = Array.from({ length: Math.min(maxItems, totalLoans) }, (_, i) => totalLoans - 1 - i);

  return (
    <GlassCard>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-text-primary">{t("dashboard.recentActivity")}</h3>
        {totalLoans > 0 && (
          <Badge variant="muted" size="sm">
            {totalLoans} {t("dashboard.loans")}
          </Badge>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-3 animate-pulse">
              <div className="w-9 h-9 rounded-xl bg-bg-secondary" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-bg-secondary rounded w-3/4" />
                <div className="h-3 bg-bg-secondary rounded w-1/3" />
              </div>
              <div className="space-y-2">
                <div className="h-4 bg-bg-secondary rounded w-16" />
                <div className="h-3 bg-bg-secondary rounded w-10 ml-auto" />
              </div>
            </div>
          ))}
        </div>
      ) : totalLoans === 0 ? (
        <div className="text-center py-8">
          <Clock className="w-8 h-8 text-text-muted mx-auto mb-2" />
          <p className="text-sm text-text-muted">{t("dashboard.noRecentActivity")}</p>
        </div>
      ) : (
        <div>
          {loanIds.map((id) => (
            <LoanActivityItem key={id} loanId={id} />
          ))}
        </div>
      )}
    </GlassCard>
  );
}
