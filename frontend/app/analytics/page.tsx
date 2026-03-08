"use client";

import { useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { CONTRACTS, COLLATERAL_TOKENS } from "@/lib/contracts";
import {
  LoanManagerNextIdABI,
  OrderBookABI,
  RiskEngineABI,
  PriceOracleABI,
  CollateralManagerABI,
  ERC20ABI,
} from "@/lib/abis";
import { formatUsdc } from "@/lib/utils";
import { motion } from "framer-motion";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { ChartCard } from "@/components/ui/ChartCard";
import { TokenIcon } from "@/components/ui/TokenIcon";
import { StatCardSkeleton } from "@/components/ui/Skeleton";
import {
  TrendingUp,
  Coins,
  Users,
  Vault,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
  Percent,
  ShieldCheck,
} from "lucide-react";
import clsx from "clsx";
import { useTranslation } from "@/i18n/context";
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
  AreaChart,
  Area,
} from "recharts";

/* ─── Constants ─── */
const PIE_COLORS = [
  "#3b82f6", "#8b5cf6", "#22c55e", "#06b6d4", "#eab308", "#ec4899", "#f97316",
  "#14b8a6", "#f43f5e", "#a855f7", "#84cc16", "#0ea5e9", "#d946ef", "#facc15",
  "#10b981", "#6366f1", "#fb923c", "#e879f9", "#38bdf8", "#a3e635", "#fbbf24",
];

const TOOLTIP_STYLE = {
  backgroundColor: "#1a1d2e",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "12px",
  color: "#e2e4ea",
};

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

/* ─── Simulated historical data ─── */
const simulatedActivityData = [
  { mes: "Sep", prestamos: 3, ordenes: 8, solicitudes: 5 },
  { mes: "Oct", prestamos: 7, ordenes: 15, solicitudes: 10 },
  { mes: "Nov", prestamos: 12, ordenes: 22, solicitudes: 18 },
  { mes: "Dic", prestamos: 18, ordenes: 30, solicitudes: 25 },
  { mes: "Ene", prestamos: 25, ordenes: 42, solicitudes: 33 },
  { mes: "Feb", prestamos: 35, ordenes: 55, solicitudes: 44 },
  { mes: "Mar", prestamos: 48, ordenes: 70, solicitudes: 58 },
];

/* ─── Interest rate data ─── */
const interestRateData = [
  { bracket: "7 dias", tasa: 2, fill: "#22c55e" },
  { bracket: "14 dias", tasa: 4, fill: "#3b82f6" },
  { bracket: "30 dias", tasa: 8, fill: "#8b5cf6" },
];

/* ─── Per-token hooks (called at top level with stable order) ─── */
function useTokenCollateral(token: (typeof COLLATERAL_TOKENS)[number]) {
  const { data: collateral, isLoading } = useReadContract({
    address: CONTRACTS.CollateralManager,
    abi: CollateralManagerABI,
    functionName: "totalCollateral",
    args: [token.address],
  });
  return {
    value: collateral ? Number(formatUnits(collateral, token.decimals)) : 0,
    isLoading,
  };
}

function useTokenPrice(token: (typeof COLLATERAL_TOKENS)[number]) {
  const { data: priceData, isLoading } = useReadContract({
    address: CONTRACTS.PriceOracle,
    abi: PriceOracleABI,
    functionName: "getPrice",
    args: [token.address],
  });
  return {
    precio: priceData ? Number(priceData[0]) / 1e6 : 0,
    isLoading,
  };
}

/* ─── Token Exposure Card ─── */
function TokenExposureCard({ token }: { token: (typeof COLLATERAL_TOKENS)[number] }) {
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
  const ltv = riskParams ? Number(riskParams[0]) / 100 : 0;
  const liqThreshold = riskParams ? Number(riskParams[1]) / 100 : 0;
  const maxExp = riskParams ? riskParams[2] : BigInt(0);
  const curExp = exposure ?? BigInt(0);
  const expPct = maxExp > BigInt(0) ? Math.min(Number((curExp * BigInt(100)) / maxExp), 100) : 0;

  return (
    <motion.div
      variants={item}
      className="rounded-xl bg-bg-card border border-border hover:border-border-hover transition-all duration-300 p-4 relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl opacity-5 -translate-y-1/2 translate-x-1/2 bg-accent-blue" />

      <div className="flex items-center justify-between mb-3 relative z-10">
        <div className="flex items-center gap-2.5">
          <TokenIcon symbol={token.symbol} size="md" />
          <div>
            <h3 className="text-text-primary font-semibold text-base">{token.symbol}</h3>
            <Badge variant={isActive ? "success" : "muted"} size="sm">
              {isActive ? t("common.active") : t("common.inactive")}
            </Badge>
          </div>
        </div>
      </div>

      {/* Exposure bar */}
      <div className="mb-3 relative z-10">
        <div className="flex items-center justify-between mb-1">
          <span className="text-text-muted text-[11px] uppercase tracking-wider">{t("common.exposure")}</span>
          <span className="text-text-primary text-xs font-mono">
            {formatUsdc(curExp)} / {formatUsdc(maxExp)} USDC
          </span>
        </div>
        <div className="w-full h-2 rounded-full bg-bg-secondary overflow-hidden">
          <div
            className={clsx(
              "h-full rounded-full transition-all duration-700",
              expPct >= 80 ? "bg-accent-red" : expPct >= 50 ? "bg-accent-yellow" : "bg-accent-green"
            )}
            style={{ width: `${expPct}%` }}
          />
        </div>
        <div className="flex justify-end mt-1">
          <span
            className={clsx(
              "text-xs font-bold",
              expPct >= 80 ? "text-accent-red" : expPct >= 50 ? "text-accent-yellow" : "text-accent-green"
            )}
          >
            {expPct.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* LTV & Liquidation */}
      <div className="grid grid-cols-2 gap-3 relative z-10">
        <div className="bg-bg-secondary/40 rounded-xl p-3">
          <p className="text-text-muted text-[10px] uppercase tracking-wider mb-0.5">LTV</p>
          <p className="text-text-primary font-bold text-base">{ltv > 0 ? `${ltv}%` : "-"}</p>
        </div>
        <div className="bg-bg-secondary/40 rounded-xl p-3">
          <p className="text-text-muted text-[10px] uppercase tracking-wider mb-0.5">{t("analytics.liqThreshold")}</p>
          <p className="text-text-primary font-bold text-base">{liqThreshold > 0 ? `${liqThreshold}%` : "-"}</p>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Custom Pie Label ─── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderPieLabel(props: any) {
  const { cx, cy, midAngle, innerRadius, outerRadius, name, percent } = props;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 1.4;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text x={x} y={y} fill="#e2e4ea" textAnchor={x > cx ? "start" : "end"} dominantBaseline="central" fontSize={12}>
      {name} ({(percent * 100).toFixed(0)}%)
    </text>
  );
}

/* ─── Main Page ─── */
export default function AnalyticsPage() {
  const { t } = useTranslation();
  /* Stat card data */
  const { data: nextLoanId, isLoading: loadingLoans } = useReadContract({
    address: CONTRACTS.LoanManager,
    abi: LoanManagerNextIdABI,
    functionName: "nextLoanId",
  });

  const { data: nextLendingOrderId, isLoading: loadingOrders } = useReadContract({
    address: CONTRACTS.OrderBook,
    abi: OrderBookABI,
    functionName: "nextLendingOrderId",
  });

  const { data: nextBorrowRequestId, isLoading: loadingRequests } = useReadContract({
    address: CONTRACTS.OrderBook,
    abi: OrderBookABI,
    functionName: "nextBorrowRequestId",
  });

  const { data: reserveBalance, isLoading: loadingReserve } = useReadContract({
    address: CONTRACTS.USDC,
    abi: ERC20ABI,
    functionName: "balanceOf",
    args: [CONTRACTS.ReserveFund],
  });

  const statsLoading = loadingLoans || loadingOrders || loadingRequests || loadingReserve;

  /* Collateral data — individual hooks at top level (stable call order, COLLATERAL_TOKENS is const) */
  const c0 = useTokenCollateral(COLLATERAL_TOKENS[0]);
  const c1 = useTokenCollateral(COLLATERAL_TOKENS[1]);
  const c2 = useTokenCollateral(COLLATERAL_TOKENS[2]);
  const c3 = useTokenCollateral(COLLATERAL_TOKENS[3]);
  const c4 = useTokenCollateral(COLLATERAL_TOKENS[4]);
  const c5 = useTokenCollateral(COLLATERAL_TOKENS[5]);
  const c6 = useTokenCollateral(COLLATERAL_TOKENS[6]);
  const c7 = useTokenCollateral(COLLATERAL_TOKENS[7]);
  const c8 = useTokenCollateral(COLLATERAL_TOKENS[8]);
  const c9 = useTokenCollateral(COLLATERAL_TOKENS[9]);
  const c10 = useTokenCollateral(COLLATERAL_TOKENS[10]);
  const c11 = useTokenCollateral(COLLATERAL_TOKENS[11]);
  const c12 = useTokenCollateral(COLLATERAL_TOKENS[12]);
  const c13 = useTokenCollateral(COLLATERAL_TOKENS[13]);
  const c14 = useTokenCollateral(COLLATERAL_TOKENS[14]);
  const c15 = useTokenCollateral(COLLATERAL_TOKENS[15]);
  const c16 = useTokenCollateral(COLLATERAL_TOKENS[16]);
  const c17 = useTokenCollateral(COLLATERAL_TOKENS[17]);
  const c18 = useTokenCollateral(COLLATERAL_TOKENS[18]);
  const c19 = useTokenCollateral(COLLATERAL_TOKENS[19]);
  const c20 = useTokenCollateral(COLLATERAL_TOKENS[20]);
  const collateralResults = [c0, c1, c2, c3, c4, c5, c6, c7, c8, c9, c10, c11, c12, c13, c14, c15, c16, c17, c18, c19, c20];

  const collateralData = COLLATERAL_TOKENS
    .map((token, i) => ({
      name: token.symbol,
      value: collateralResults[i].value,
      fill: PIE_COLORS[i % PIE_COLORS.length],
    }))
    .filter((d) => d.value > 0);

  const loadingCollateral = collateralResults.some((r) => r.isLoading);

  /* Price data — individual hooks at top level */
  const p0 = useTokenPrice(COLLATERAL_TOKENS[0]);
  const p1 = useTokenPrice(COLLATERAL_TOKENS[1]);
  const p2 = useTokenPrice(COLLATERAL_TOKENS[2]);
  const p3 = useTokenPrice(COLLATERAL_TOKENS[3]);
  const p4 = useTokenPrice(COLLATERAL_TOKENS[4]);
  const p5 = useTokenPrice(COLLATERAL_TOKENS[5]);
  const p6 = useTokenPrice(COLLATERAL_TOKENS[6]);
  const p7 = useTokenPrice(COLLATERAL_TOKENS[7]);
  const p8 = useTokenPrice(COLLATERAL_TOKENS[8]);
  const p9 = useTokenPrice(COLLATERAL_TOKENS[9]);
  const p10 = useTokenPrice(COLLATERAL_TOKENS[10]);
  const p11 = useTokenPrice(COLLATERAL_TOKENS[11]);
  const p12 = useTokenPrice(COLLATERAL_TOKENS[12]);
  const p13 = useTokenPrice(COLLATERAL_TOKENS[13]);
  const p14 = useTokenPrice(COLLATERAL_TOKENS[14]);
  const p15 = useTokenPrice(COLLATERAL_TOKENS[15]);
  const p16 = useTokenPrice(COLLATERAL_TOKENS[16]);
  const p17 = useTokenPrice(COLLATERAL_TOKENS[17]);
  const p18 = useTokenPrice(COLLATERAL_TOKENS[18]);
  const p19 = useTokenPrice(COLLATERAL_TOKENS[19]);
  const p20 = useTokenPrice(COLLATERAL_TOKENS[20]);
  const priceResults = [p0, p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15, p16, p17, p18, p19, p20];

  const priceData = COLLATERAL_TOKENS.map((token, i) => ({
    name: token.symbol,
    precio: priceResults[i].precio,
    fill: PIE_COLORS[i % PIE_COLORS.length],
  }));

  const loadingPrices = priceResults.some((r) => r.isLoading);

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-accent-purple/10 flex items-center justify-center">
            <BarChart3 className="w-4.5 h-4.5 text-accent-purple" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">{t("analytics.title")}</h1>
            <p className="text-text-secondary text-sm">{t("analytics.subtitle")}</p>
          </div>
        </div>
      </motion.div>

      {/* ── Stat Cards ── */}
      <motion.section variants={container} initial="hidden" animate="show">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statsLoading ? (
            <>
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </>
          ) : (
            <>
              <motion.div variants={item}>
                <StatCard
                  title={t("analytics.loansCreated")}
                  value={nextLoanId ? Number(nextLoanId).toString() : "0"}
                  subtitle={t("analytics.totalHistoric")}
                  icon={<TrendingUp className="w-5 h-5" />}
                  gradient="blue"
                />
              </motion.div>
              <motion.div variants={item}>
                <StatCard
                  title={t("analytics.lendingOrders")}
                  value={nextLendingOrderId ? Number(nextLendingOrderId).toString() : "0"}
                  subtitle={t("analytics.ordersCreated")}
                  icon={<Coins className="w-5 h-5" />}
                  gradient="green"
                />
              </motion.div>
              <motion.div variants={item}>
                <StatCard
                  title={t("analytics.borrowRequests")}
                  value={nextBorrowRequestId ? Number(nextBorrowRequestId).toString() : "0"}
                  subtitle={t("analytics.requestsCreated")}
                  icon={<Users className="w-5 h-5" />}
                  gradient="purple"
                />
              </motion.div>
              <motion.div variants={item}>
                <StatCard
                  title={t("analytics.reserveFund")}
                  value={reserveBalance ? `$${formatUsdc(reserveBalance)}` : "$0.00"}
                  subtitle={t("analytics.usdcBalance")}
                  icon={<Vault className="w-5 h-5" />}
                  gradient="cyan"
                />
              </motion.div>
            </>
          )}
        </div>
      </motion.section>

      {/* ── Charts Row: Collateral Distribution + Token Prices ── */}
      <motion.section
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 lg:grid-cols-2 gap-4"
      >
        {/* Collateral Distribution Pie */}
        <motion.div variants={item}>
          <ChartCard
            title={t("analytics.collateralDist")}
            subtitle={t("analytics.collateralDistSub")}
          >
            <div className="flex items-center gap-2 mb-4">
              <PieChartIcon className="w-4 h-4 text-text-muted" />
              <Badge variant="info" size="sm">{t("common.liveData")}</Badge>
            </div>
            {loadingCollateral ? (
              <div className="h-[300px] flex items-center justify-center">
                <span className="text-text-muted text-sm">{t("analytics.loadingData")}</span>
              </div>
            ) : collateralData.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center">
                <span className="text-text-muted text-sm">{t("analytics.noCollateral")}</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={collateralData}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    innerRadius={55}
                    dataKey="value"
                    label={renderPieLabel}
                    labelLine={false}
                    stroke="none"
                  >
                    {collateralData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={((value: number) => [value.toFixed(4), t("analytics.quantity")]) as any}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
            {/* Legend */}
            {collateralData.length > 0 && (
              <div className="flex flex-wrap gap-3 mt-4 justify-center">
                {collateralData.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.fill }} />
                    <span className="text-text-muted text-xs">{entry.name}</span>
                  </div>
                ))}
              </div>
            )}
          </ChartCard>
        </motion.div>

        {/* Token Prices Bar Chart */}
        <motion.div variants={item}>
          <ChartCard
            title={t("analytics.tokenPrices")}
            subtitle={t("analytics.tokenPricesSub")}
          >
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-text-muted" />
              <Badge variant="info" size="sm">{t("common.liveOracle")}</Badge>
            </div>
            {loadingPrices ? (
              <div className="h-[300px] flex items-center justify-center">
                <span className="text-text-muted text-sm">{t("analytics.loadingPrices")}</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={priceData} barSize={36}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "#9ca3af", fontSize: 12 }}
                    axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#9ca3af", fontSize: 12 }}
                    axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                    tickLine={false}
                    tickFormatter={(v: number) => `$${v}`}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={((value: number) => [`$${value.toFixed(2)}`, t("common.price")]) as any}
                  />
                  <Bar dataKey="precio" radius={[6, 6, 0, 0]}>
                    {priceData.map((_, index) => (
                      <Cell key={`bar-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </motion.div>
      </motion.section>

      {/* ── Token Exposure Analysis ── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="w-4 h-4 text-text-muted" />
          <h2 className="text-base font-semibold text-text-primary">{t("analytics.tokenExposure")}</h2>
          <Badge variant="info" size="sm">{t("common.liveData")}</Badge>
        </div>
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
        >
          {COLLATERAL_TOKENS.map((token) => (
            <TokenExposureCard key={token.symbol} token={token} />
          ))}
        </motion.div>
      </section>

      {/* ── Protocol Activity (Simulated) ── */}
      <motion.section variants={container} initial="hidden" animate="show">
        <motion.div variants={item}>
          <ChartCard
            title={t("analytics.protocolActivity")}
            subtitle={t("analytics.protocolActivitySub")}
          >
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4 text-text-muted" />
              <Badge variant="warning" size="sm">{t("common.illustrativeData")}</Badge>
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={simulatedActivityData}>
                <defs>
                  <linearGradient id="gradPrestamos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradOrdenes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradSolicitudes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="mes"
                  tick={{ fill: "#9ca3af", fontSize: 12 }}
                  axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#9ca3af", fontSize: 12 }}
                  axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                  tickLine={false}
                />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Area
                  type="monotone"
                  dataKey="prestamos"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#gradPrestamos)"
                  name={t("analytics.chartLoans")}
                />
                <Area
                  type="monotone"
                  dataKey="ordenes"
                  stroke="#22c55e"
                  strokeWidth={2}
                  fill="url(#gradOrdenes)"
                  name={t("analytics.chartOrders")}
                />
                <Area
                  type="monotone"
                  dataKey="solicitudes"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  fill="url(#gradSolicitudes)"
                  name={t("analytics.chartRequests")}
                />
              </AreaChart>
            </ResponsiveContainer>
            {/* Legend */}
            <div className="flex flex-wrap gap-4 mt-4 justify-center">
              {[
                { label: t("analytics.chartLoans"), color: "#3b82f6" },
                { label: t("analytics.chartOrders"), color: "#22c55e" },
                { label: t("analytics.chartRequests"), color: "#8b5cf6" },
              ].map((l) => (
                <div key={l.label} className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: l.color }} />
                  <span className="text-text-muted text-xs">{l.label}</span>
                </div>
              ))}
            </div>
          </ChartCard>
        </motion.div>
      </motion.section>

      {/* ── Interest Rate Breakdown ── */}
      <motion.section variants={container} initial="hidden" animate="show">
        <motion.div variants={item}>
          <ChartCard
            title={t("analytics.interestBrackets")}
            subtitle={t("analytics.interestBracketsSub")}
          >
            <div className="flex items-center gap-2 mb-4">
              <Percent className="w-4 h-4 text-text-muted" />
              <Badge variant="muted" size="sm">{t("common.protocolConfig")}</Badge>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={interestRateData} layout="vertical" barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fill: "#9ca3af", fontSize: 12 }}
                  axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                  tickLine={false}
                  tickFormatter={(v: number) => `${v}%`}
                  domain={[0, 10]}
                />
                <YAxis
                  type="category"
                  dataKey="bracket"
                  tick={{ fill: "#9ca3af", fontSize: 12 }}
                  axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                  tickLine={false}
                  width={70}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={((value: number) => [`${value}%`, t("analytics.rate")]) as any}
                />
                <Bar dataKey="tasa" radius={[0, 6, 6, 0]}>
                  {interestRateData.map((entry, index) => (
                    <Cell key={`rate-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {/* Text summary */}
            <div className="grid grid-cols-3 gap-2 mt-4">
              {[
                { period: "7 dias", rate: "2%", color: "text-accent-green", bg: "bg-accent-green/10" },
                { period: "14 dias", rate: "4%", color: "text-accent-blue", bg: "bg-accent-blue/10" },
                { period: "30 dias", rate: "8%", color: "text-accent-purple", bg: "bg-accent-purple/10" },
              ].map((b) => (
                <div key={b.period} className={clsx("rounded-xl p-3 text-center", b.bg)}>
                  <p className="text-text-muted text-[10px] uppercase tracking-wider mb-1">{b.period}</p>
                  <p className={clsx("text-xl font-bold", b.color)}>{b.rate}</p>
                </div>
              ))}
            </div>
          </ChartCard>
        </motion.div>
      </motion.section>
    </div>
  );
}
