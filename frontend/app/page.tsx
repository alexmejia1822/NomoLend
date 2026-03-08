"use client";

import { useAccount, useReadContract } from "wagmi";
import Link from "next/link";
import { motion } from "framer-motion";
import { useTranslation } from "@/i18n/context";
import { CONTRACTS, COLLATERAL_TOKENS } from "@/lib/contracts";
import {
  RiskEngineABI,
  LoanManagerNextIdABI,
} from "@/lib/abis";
import {
  useLendingOrderCount,
  useBorrowRequestCount,
} from "@/hooks/useOrderBook";
import { formatUsdc } from "@/lib/utils";
import { StatCard } from "@/components/ui/StatCard";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { TokenIcon } from "@/components/ui/TokenIcon";
import { StatCardSkeleton } from "@/components/ui/Skeleton";
import { ChartCard } from "@/components/ui/ChartCard";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  Landmark,
  Users,
  ArrowLeftRight,
  ShieldCheck,
  ExternalLink,
  TrendingUp,
  Coins,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { ActivityFeed } from "@/components/ui/ActivityFeed";
import clsx from "clsx";

/* ------------------------------------------------------------------ */
/*  Animation variants                                                 */
/* ------------------------------------------------------------------ */

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45 } },
};

/* ------------------------------------------------------------------ */
/*  Token Exposure Row                                                 */
/* ------------------------------------------------------------------ */

function TokenExposureRow({
  token,
}: {
  token: (typeof COLLATERAL_TOKENS)[number];
}) {
  const { t } = useTranslation();
  const { data: riskParams } = useReadContract({
    address: CONTRACTS.RiskEngine,
    abi: RiskEngineABI,
    functionName: "tokenRiskParams",
    args: [token.address],
  });

  const { data: exposure } = useReadContract({
    address: CONTRACTS.RiskEngine,
    abi: RiskEngineABI,
    functionName: "currentExposure",
    args: [token.address],
  });

  const isActive = riskParams ? riskParams[3] : false;
  const maxExp = riskParams ? riskParams[2] : 0n;
  const curExp = exposure ?? 0n;
  const pct = maxExp > 0n ? Number((curExp * 100n) / maxExp) : 0;

  const riskVariant: "success" | "warning" | "danger" =
    pct > 80 ? "danger" : pct > 50 ? "warning" : "success";
  const riskLabel = pct > 80 ? t("common.high") : pct > 50 ? t("common.medium") : t("common.low");

  return (
    <tr className="border-b border-border last:border-b-0 hover:bg-white/[0.02] transition-colors">
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <TokenIcon symbol={token.symbol} size="sm" />
          <span className="text-xs font-semibold text-text-primary">
            {token.symbol}
          </span>
        </div>
      </td>
      <td className="px-3 py-2 text-right">
        <span className="text-xs font-medium text-text-primary">
          {formatUsdc(curExp)}
        </span>
      </td>
      <td className="px-3 py-2 text-right">
        <span className="text-xs text-text-muted">{formatUsdc(maxExp)}</span>
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-bg-secondary rounded-full overflow-hidden">
            <div
              className={clsx(
                "h-full rounded-full transition-all duration-500",
                pct > 80
                  ? "bg-accent-red"
                  : pct > 50
                    ? "bg-accent-yellow"
                    : "bg-accent-green"
              )}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
          <span className="text-[10px] text-text-muted w-8 text-right">
            {pct}%
          </span>
        </div>
      </td>
      <td className="px-3 py-2 text-center">
        <Badge variant={riskVariant}>{riskLabel}</Badge>
      </td>
      <td className="px-3 py-2 text-center">
        <Badge variant={isActive ? "success" : "muted"}>
          {isActive ? t("common.active") : t("common.inactive")}
        </Badge>
      </td>
    </tr>
  );
}

/* ------------------------------------------------------------------ */
/*  How It Works Step                                                   */
/* ------------------------------------------------------------------ */

function StepCard({
  step,
  icon,
  title,
  description,
}: {
  step: number;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <motion.div variants={itemVariants} className="relative flex flex-col items-center text-center">
      <div className="relative mb-3">
        <div className="w-11 h-11 rounded-xl bg-accent-blue/10 border border-accent-blue/20 flex items-center justify-center text-accent-blue">
          {icon}
        </div>
        <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-accent-blue text-white text-[10px] font-bold flex items-center justify-center">
          {step}
        </span>
      </div>
      <h3 className="text-text-primary text-sm font-semibold mb-1">{title}</h3>
      <p className="text-text-muted text-xs leading-relaxed">{description}</p>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Dashboard Page                                                     */
/* ------------------------------------------------------------------ */

export default function Dashboard() {
  const { t } = useTranslation();
  const { isConnected } = useAccount();
  const { data: lendingCount, isLoading: lendingLoading } =
    useLendingOrderCount();
  const { data: borrowCount, isLoading: borrowLoading } =
    useBorrowRequestCount();

  const { data: nextLoanId, isLoading: loansLoading } = useReadContract({
    address: CONTRACTS.LoanManager,
    abi: LoanManagerNextIdABI,
    functionName: "nextLoanId",
  });

  const totalLoans = nextLoanId ? Number(nextLoanId) : 0;
  const isStatsLoading = lendingLoading || borrowLoading || loansLoading;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6 pb-10"
    >
      {/* ── Hero Section ──────────────────────────────────────────── */}
      <motion.section variants={itemVariants} className="relative overflow-hidden rounded-2xl bg-bg-card border border-border p-6 md:p-8">
        {/* Background glow */}
        <div className="absolute top-0 left-1/4 w-72 h-72 bg-accent-blue/8 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-56 h-56 bg-accent-purple/8 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-xl">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-lg bg-accent-blue/10 border border-accent-blue/20 flex items-center justify-center">
              <Landmark className="w-4 h-4 text-accent-blue" />
            </div>
            <Badge variant="info" size="sm">Base Mainnet</Badge>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-text-primary mb-2">
            Nomo<span className="gradient-text">Lend</span>
          </h1>
          <p className="text-text-secondary text-sm leading-relaxed">
            {t("dashboard.heroDesc")}
          </p>

          {!isConnected && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent-yellow/10 border border-accent-yellow/20 px-3 py-2">
              <ShieldCheck className="w-3.5 h-3.5 text-accent-yellow" />
              <span className="text-xs text-accent-yellow font-medium">
                {t("dashboard.connectPrompt")}
              </span>
            </div>
          )}
        </div>
      </motion.section>

      {/* ── Quick Actions ─────────────────────────────────────────── */}
      <motion.section variants={itemVariants}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Lend Card */}
          <div className="relative overflow-hidden rounded-xl bg-bg-card border border-border p-5 hover:border-border-hover transition-all duration-300 group">
            <div className="absolute top-0 right-0 w-36 h-36 bg-accent-blue/8 rounded-full blur-3xl pointer-events-none group-hover:bg-accent-blue/12 transition-all duration-500" />
            <div className="relative z-10">
              <div className="w-9 h-9 rounded-lg bg-accent-blue/10 border border-accent-blue/20 flex items-center justify-center mb-3">
                <TrendingUp className="w-4 h-4 text-accent-blue" />
              </div>
              <h2 className="text-base font-bold text-text-primary mb-1">
                {t("dashboard.lendUsdc")}
              </h2>
              <p className="text-text-muted text-xs mb-4 leading-relaxed">
                {t("dashboard.lendDesc")}
              </p>
              <div className="space-y-1.5 text-xs mb-4">
                <div className="flex items-center justify-between py-1 px-2.5 rounded-md bg-bg-secondary">
                  <span className="text-text-secondary">{t("durations.0")}</span>
                  <span className="font-semibold text-accent-green">2%</span>
                </div>
                <div className="flex items-center justify-between py-1 px-2.5 rounded-md bg-bg-secondary">
                  <span className="text-text-secondary">{t("durations.1")}</span>
                  <span className="font-semibold text-accent-green">4%</span>
                </div>
                <div className="flex items-center justify-between py-1 px-2.5 rounded-md bg-bg-secondary">
                  <span className="text-text-secondary">{t("durations.2")}</span>
                  <span className="font-semibold text-accent-green">8%</span>
                </div>
              </div>
              <Link href="/lend">
                <Button variant="primary" size="md" className="w-full gap-2">
                  {t("dashboard.createOffer")}
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Borrow Card */}
          <div className="relative overflow-hidden rounded-xl bg-bg-card border border-border p-5 hover:border-border-hover transition-all duration-300 group">
            <div className="absolute top-0 right-0 w-36 h-36 bg-accent-purple/8 rounded-full blur-3xl pointer-events-none group-hover:bg-accent-purple/12 transition-all duration-500" />
            <div className="relative z-10">
              <div className="w-9 h-9 rounded-lg bg-accent-purple/10 border border-accent-purple/20 flex items-center justify-center mb-3">
                <Coins className="w-4 h-4 text-accent-purple" />
              </div>
              <h2 className="text-base font-bold text-text-primary mb-1">
                {t("dashboard.requestLoan")}
              </h2>
              <p className="text-text-muted text-xs mb-4 leading-relaxed">
                {t("dashboard.borrowDesc")}
              </p>
              <div className="space-y-1.5 text-xs mb-4">
                <div className="flex items-center justify-between py-1 px-2.5 rounded-md bg-bg-secondary">
                  <span className="text-text-secondary">{t("dashboard.collateralLabel")}</span>
                  <span className="font-medium text-text-primary">{t("dashboard.riskBased")}</span>
                </div>
                <div className="flex items-center justify-between py-1 px-2.5 rounded-md bg-bg-secondary">
                  <span className="text-text-secondary">{t("dashboard.earlyPayment")}</span>
                  <span className="font-medium text-accent-green">{t("dashboard.allowed")}</span>
                </div>
                <div className="flex items-center justify-between py-1 px-2.5 rounded-md bg-bg-secondary">
                  <span className="text-text-secondary">{t("dashboard.penalty")}</span>
                  <span className="font-medium text-accent-green">{t("dashboard.none")}</span>
                </div>
              </div>
              <Link href="/borrow">
                <Button variant="primary" size="md" className="w-full gap-2 bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-600/20">
                  {t("dashboard.requestLoan")}
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </motion.section>

      {/* ── Stat Cards ────────────────────────────────────────────── */}
      <motion.section variants={itemVariants}>
        {isStatsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <StatCardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              title={t("dashboard.loansCreated")}
              value={String(totalLoans)}
              subtitle={t("dashboard.totalHistoric")}
              icon={<TrendingUp className="w-4 h-4" />}
              gradient="blue"
            />
            <StatCard
              title={t("dashboard.lendingOffers")}
              value={lendingCount ? String(Number(lendingCount)) : "0"}
              subtitle={t("dashboard.activeOrders")}
              icon={<Coins className="w-4 h-4" />}
              gradient="green"
            />
            <StatCard
              title={t("dashboard.requests")}
              value={borrowCount ? String(Number(borrowCount)) : "0"}
              subtitle={t("dashboard.activeRequests")}
              icon={<Users className="w-4 h-4" />}
              gradient="purple"
            />
            <StatCard
              title={t("dashboard.monitoredTokens")}
              value={String(COLLATERAL_TOKENS.length)}
              subtitle={t("dashboard.supportedCollateral")}
              icon={<ShieldCheck className="w-4 h-4" />}
              gradient="cyan"
            />
          </div>
        )}
      </motion.section>

      {/* ── Charts Section ──────────────────────────────────────── */}
      <motion.section variants={itemVariants}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Collateral Distribution – Donut Chart */}
          <ChartCard
            title={t("dashboard.collateralDist")}
            subtitle={t("dashboard.collateralDistSub")}
          >
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: "WETH", value: 30 },
                      { name: "cbETH", value: 25 },
                      { name: "DAI", value: 15 },
                      { name: "USDbC", value: 10 },
                      { name: "LINK", value: 8 },
                      { name: "UNI", value: 7 },
                      { name: "CYPR", value: 5 },
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {["#3b82f6", "#8b5cf6", "#22c55e", "#06b6d4", "#eab308", "#ec4899", "#f97316"].map(
                      (color, index) => (
                        <Cell key={`cell-${index}`} fill={color} />
                      )
                    )}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1a1d2e",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "12px",
                      color: "#e2e4ea",
                      fontSize: "13px",
                    }}
                    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                    formatter={((v: any, n: any) => [`${v}%`, n]) as any}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-3 mt-2">
              {[
                { name: "WETH", color: "#3b82f6" },
                { name: "cbETH", color: "#8b5cf6" },
                { name: "DAI", color: "#22c55e" },
                { name: "USDbC", color: "#06b6d4" },
                { name: "LINK", color: "#eab308" },
                { name: "UNI", color: "#ec4899" },
                { name: "CYPR", color: "#f97316" },
              ].map((item) => (
                <div key={item.name} className="flex items-center gap-1.5">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-xs text-text-muted">{item.name}</span>
                </div>
              ))}
            </div>
          </ChartCard>

          {/* Interest Rates – Bar Chart */}
          <ChartCard
            title={t("dashboard.interestRates")}
            subtitle={t("dashboard.interestRatesSub")}
          >
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    { duration: t("durations.0"), rate: 2 },
                    { duration: t("durations.1"), rate: 4 },
                    { duration: t("durations.2"), rate: 8 },
                  ]}
                  margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.05)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="duration"
                    tick={{ fill: "#8b92a5", fontSize: 13 }}
                    axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#8b92a5", fontSize: 13 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1a1d2e",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "12px",
                      color: "#e2e4ea",
                      fontSize: "13px",
                    }}
                    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                    formatter={((v: any) => [`${v}%`, t("common.interest")]) as any}
                    cursor={{ fill: "rgba(255,255,255,0.03)" }}
                  />
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" />
                      <stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>
                  </defs>
                  <Bar
                    dataKey="rate"
                    fill="url(#barGradient)"
                    radius={[8, 8, 0, 0]}
                    maxBarSize={60}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>
      </motion.section>

      {/* ── Activity Feed ─────────────────────────────────────────── */}
      <motion.section variants={itemVariants}>
        <ActivityFeed maxItems={8} />
      </motion.section>

      {/* ── How NomoLend Works ────────────────────────────────────── */}
      <motion.section variants={itemVariants}>
        <GlassCard padding="md">
          <div className="text-center mb-5">
            <h2 className="text-base font-bold text-text-primary mb-1">
              {t("dashboard.howItWorks")}
            </h2>
            <p className="text-text-muted text-xs max-w-md mx-auto">
              {t("dashboard.howItWorksSub")}
            </p>
          </div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            <StepCard
              step={1}
              icon={<Coins className="w-5 h-5" />}
              title={t("dashboard.step1Title")}
              description={t("dashboard.step1Desc")}
            />
            <StepCard
              step={2}
              icon={<ArrowLeftRight className="w-5 h-5" />}
              title={t("dashboard.step2Title")}
              description={t("dashboard.step2Desc")}
            />
            <StepCard
              step={3}
              icon={<ShieldCheck className="w-5 h-5" />}
              title={t("dashboard.step3Title")}
              description={t("dashboard.step3Desc")}
            />
          </motion.div>
        </GlassCard>
      </motion.section>

      {/* ── Token Exposure Table ──────────────────────────────────── */}
      <motion.section variants={itemVariants}>
        <GlassCard padding="md">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-text-primary">
                {t("dashboard.tokenExposure")}
              </h2>
              <p className="text-text-muted text-xs mt-0.5">
                {t("dashboard.tokenExposureSub")}
              </p>
            </div>
            <Badge variant="info" size="sm">
              {COLLATERAL_TOKENS.length} tokens
            </Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs text-text-muted font-medium uppercase tracking-wider">
                    {t("dashboard.token")}
                  </th>
                  <th className="text-right px-4 py-3 text-xs text-text-muted font-medium uppercase tracking-wider">
                    {t("common.exposure")}
                  </th>
                  <th className="text-right px-4 py-3 text-xs text-text-muted font-medium uppercase tracking-wider">
                    {t("common.max")}
                  </th>
                  <th className="text-center px-4 py-3 text-xs text-text-muted font-medium uppercase tracking-wider">
                    {t("common.usage")}
                  </th>
                  <th className="text-center px-4 py-3 text-xs text-text-muted font-medium uppercase tracking-wider">
                    {t("dashboard.riskLevel")}
                  </th>
                  <th className="text-center px-4 py-3 text-xs text-text-muted font-medium uppercase tracking-wider">
                    {t("common.status")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {COLLATERAL_TOKENS.map((token) => (
                  <TokenExposureRow key={token.symbol} token={token} />
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </motion.section>

      {/* ── Security Status ───────────────────────────────────────── */}
      <motion.section variants={itemVariants}>
        <GlassCard padding="md">
          <div className="mb-3">
            <h2 className="text-sm font-bold text-text-primary">
              {t("dashboard.securityStatus")}
            </h2>
            <p className="text-text-muted text-xs mt-0.5">
              {t("dashboard.securityStatusSub")}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
            {Array.from({ length: 8 }, (_, i) => t(`dashboard.secChecks.${i}`)).map((label) => (
              <div key={label} className="flex items-center gap-2 py-1.5 px-2 rounded-md">
                <CheckCircle2 className="w-3.5 h-3.5 text-accent-green flex-shrink-0" />
                <span className="text-xs text-text-primary">{label}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      </motion.section>

      {/* ── Contract Addresses ────────────────────────────────────── */}
      <motion.section variants={itemVariants}>
        <GlassCard padding="md">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-bold text-text-primary">
                {t("dashboard.deployedContracts")}
              </h2>
              <p className="text-text-muted text-xs mt-0.5">
                {t("dashboard.deployedContractsSub")}
              </p>
            </div>
            <Badge variant="success" size="sm">
              {t("common.verified")}
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {Object.entries(CONTRACTS).map(([name, addr]) => (
              <a
                key={name}
                href={`https://basescan.org/address/${addr}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-bg-secondary hover:bg-white/[0.04] border border-transparent hover:border-border transition-all duration-200 group"
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-accent-blue/10 flex items-center justify-center">
                    <Landmark className="w-3 h-3 text-accent-blue" />
                  </div>
                  <span className="text-xs font-medium text-text-secondary">
                    {name}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-xs text-text-muted">
                    {addr.slice(0, 6)}...{addr.slice(-4)}
                  </span>
                  <ExternalLink className="w-3 h-3 text-text-muted group-hover:text-accent-blue transition-colors" />
                </div>
              </a>
            ))}
          </div>
        </GlassCard>
      </motion.section>
    </motion.div>
  );
}
