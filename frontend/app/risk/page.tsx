"use client";

import { useReadContract } from "wagmi";
import { CONTRACTS, COLLATERAL_TOKENS } from "@/lib/contracts";
import { RiskEngineABI, PriceOracleABI } from "@/lib/abis";
import { formatUsdc } from "@/lib/utils";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { TokenIcon } from "@/components/ui/TokenIcon";
import { useTranslation } from "@/i18n/context";
import clsx from "clsx";
import {
  Shield,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Percent,
  BarChart3,
  Lock,
  Layers,
} from "lucide-react";

/* ─── helpers ─── */
function getTierForLtv(ltv: number): { label: string; variant: "success" | "info" | "warning" | "danger" } {
  if (ltv >= 40) return { label: "A", variant: "success" };
  if (ltv >= 35) return { label: "B", variant: "info" };
  if (ltv >= 30) return { label: "C", variant: "warning" };
  return { label: "D", variant: "danger" };
}

/* ─── Token Risk Card ─── */
function TokenRiskCard({ token }: { token: (typeof COLLATERAL_TOKENS)[number] }) {
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

  const { data: priceData } = useReadContract({
    address: CONTRACTS.PriceOracle,
    abi: PriceOracleABI,
    functionName: "getPrice",
    args: [token.address],
  });

  const isActive = riskParams ? riskParams[3] : false;
  const ltv = riskParams ? Number(riskParams[0]) / 100 : 0;
  const liqThreshold = riskParams ? Number(riskParams[1]) / 100 : 0;
  const maxExp = riskParams ? riskParams[2] : 0n;
  const curExp = exposure ?? 0n;
  const price = priceData ? Number(priceData[0]) / 1e6 : 0;
  const confidence = priceData ? priceData[1] : false;

  const expPct = maxExp > 0n ? Math.min(Number((curExp * 100n) / maxExp), 100) : 0;
  const tier = getTierForLtv(ltv);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl bg-bg-card border border-border hover:border-border-hover transition-all duration-300 p-4 relative overflow-hidden"
    >
      {/* Subtle gradient glow */}
      <div className="absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl opacity-5 -translate-y-1/2 translate-x-1/2 bg-accent-blue" />

      {/* Header: icon + symbol + status */}
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
        <Badge variant={tier.variant} size="md">{t("risk.tier")} {tier.label}</Badge>
      </div>

      {/* Price */}
      <div className="mb-4 relative z-10">
        <p className="text-text-muted text-[11px] uppercase tracking-wider mb-0.5">{t("common.price")}</p>
        <div className="flex items-baseline gap-2">
          <p className="text-xl font-bold text-text-primary">
            {price > 0 ? `$${price.toFixed(2)}` : "-"}
          </p>
          {priceData && (
            <span className={clsx(
              "text-xs font-medium",
              confidence ? "text-accent-green" : "text-accent-yellow"
            )}>
              {confidence ? t("common.reliable") : t("common.lowConfidence")}
            </span>
          )}
        </div>
      </div>

      {/* LTV bar */}
      <div className="mb-3 relative z-10">
        <div className="flex items-center justify-between mb-1">
          <span className="text-text-muted text-xs">LTV</span>
          <span className="text-text-primary text-sm font-medium">{ltv > 0 ? `${ltv}%` : "-"}</span>
        </div>
        <div className="w-full h-2 rounded-full bg-bg-secondary overflow-hidden">
          <div
            className="h-full rounded-full bg-accent-blue transition-all duration-500"
            style={{ width: `${Math.min(ltv, 100)}%` }}
          />
        </div>
      </div>

      {/* Liquidation threshold */}
      <div className="mb-3 relative z-10">
        <div className="flex items-center justify-between mb-1">
          <span className="text-text-muted text-xs">{t("risk.liqThreshold")}</span>
          <span className="text-text-primary text-sm font-medium">{liqThreshold > 0 ? `${liqThreshold}%` : "-"}</span>
        </div>
        <div className="w-full h-2 rounded-full bg-bg-secondary overflow-hidden">
          <div
            className="h-full rounded-full bg-accent-yellow transition-all duration-500"
            style={{ width: `${Math.min(liqThreshold, 100)}%` }}
          />
        </div>
      </div>

      {/* Exposure bar */}
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-1">
          <span className="text-text-muted text-xs">{t("common.exposure")}</span>
          <span className="text-text-primary text-xs font-mono">
            {formatUsdc(curExp)} / {formatUsdc(maxExp)} USDC
          </span>
        </div>
        <div className="w-full h-2 rounded-full bg-bg-secondary overflow-hidden">
          <div
            className={clsx(
              "h-full rounded-full transition-all duration-500",
              expPct >= 80 ? "bg-accent-red" : expPct >= 50 ? "bg-accent-yellow" : "bg-accent-green"
            )}
            style={{ width: `${expPct}%` }}
          />
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Risk Tier Row ─── */
const riskTiers = [
  { tier: "Tier A", label: "A", marketCap: "> $150M", ltv: "40%", liquidation: "60%", variant: "success" as const, color: "text-accent-green", bgColor: "bg-accent-green/10" },
  { tier: "Tier B", label: "B", marketCap: "> $100M", ltv: "35%", liquidation: "55%", variant: "info" as const, color: "text-accent-blue", bgColor: "bg-accent-blue/10" },
  { tier: "Tier C", label: "C", marketCap: "> $50M", ltv: "30%", liquidation: "50%", variant: "warning" as const, color: "text-accent-yellow", bgColor: "bg-accent-yellow/10" },
  { tier: "Tier D", label: "D", marketCap: "> $20M", ltv: "25%", liquidation: "50%", variant: "danger" as const, color: "text-accent-red", bgColor: "bg-accent-red/10" },
];

/* ─── Security Check Item ─── */
function SecurityCheck({ label, passed }: { label: string; passed: boolean }) {
  return (
    <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-bg-secondary/40">
      {passed ? (
        <CheckCircle2 className="w-4.5 h-4.5 text-accent-green flex-shrink-0" />
      ) : (
        <XCircle className="w-4.5 h-4.5 text-accent-red flex-shrink-0" />
      )}
      <span className="text-text-secondary text-sm">{label}</span>
    </div>
  );
}

/* ─── Main Page ─── */
export default function RiskPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-accent-blue/10 flex items-center justify-center">
            <Shield className="w-4.5 h-4.5 text-accent-blue" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">{t("risk.title")}</h1>
            <p className="text-text-secondary text-sm">
              {t("risk.subtitle")}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Token Risk Grid */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-5 h-5 text-text-muted" />
          <h2 className="text-base font-semibold text-text-primary">{t("risk.acceptedTokens")}</h2>
          <Badge variant="info" size="sm">{t("common.liveData")}</Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {COLLATERAL_TOKENS.map((token) => (
            <TokenRiskCard key={token.symbol} token={token} />
          ))}
        </div>
      </section>

      {/* Risk Tiers Table */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Layers className="w-5 h-5 text-text-muted" />
          <h2 className="text-base font-semibold text-text-primary">{t("risk.riskTierTable")}</h2>
        </div>
        <GlassCard padding="sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs text-text-muted font-medium uppercase tracking-wider">{t("risk.tier")}</th>
                  <th className="text-left px-4 py-3 text-xs text-text-muted font-medium uppercase tracking-wider">{t("risk.marketCap")}</th>
                  <th className="text-center px-4 py-3 text-xs text-text-muted font-medium uppercase tracking-wider">LTV</th>
                  <th className="text-center px-4 py-3 text-xs text-text-muted font-medium uppercase tracking-wider">{t("risk.liqThreshold")}</th>
                  <th className="text-center px-4 py-3 text-xs text-text-muted font-medium uppercase tracking-wider">{t("risk.minCollateral")}</th>
                </tr>
              </thead>
              <tbody>
                {riskTiers.map((tier, i) => (
                  <motion.tr
                    key={tier.tier}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="border-b border-border/50 hover:bg-bg-secondary/30 transition-colors"
                  >
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <div className={clsx("w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm", tier.bgColor, tier.color)}>
                          {tier.label}
                        </div>
                        <span className={clsx("font-semibold", tier.color)}>{tier.tier}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-text-secondary">{tier.marketCap}</td>
                    <td className="px-4 py-4 text-center">
                      <Badge variant={tier.variant} size="md">{tier.ltv}</Badge>
                    </td>
                    <td className="px-4 py-4 text-center text-text-secondary">{tier.liquidation}</td>
                    <td className="px-4 py-4 text-center text-text-secondary font-mono">
                      {(100 / parseFloat(tier.ltv)).toFixed(1)}x
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </section>

      {/* Interest Rates */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Percent className="w-5 h-5 text-text-muted" />
          <h2 className="text-base font-semibold text-text-primary">{t("risk.interestBrackets")}</h2>
        </div>
        <p className="text-text-muted text-sm mb-4">
          {t("risk.interestBracketsDesc")}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { bracket: t("risk.bracket1"), rate: "2%", period: t("risk.upTo7days"), icon: <Clock className="w-5 h-5" />, gradient: "green" as const, barPct: 33 },
            { bracket: t("risk.bracket2"), rate: "4%", period: t("risk.7to14days"), icon: <TrendingUp className="w-5 h-5" />, gradient: "blue" as const, barPct: 66 },
            { bracket: t("risk.bracket3"), rate: "8%", period: t("risk.14to30days"), icon: <AlertTriangle className="w-5 h-5" />, gradient: "purple" as const, barPct: 100 },
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="relative overflow-hidden rounded-2xl bg-bg-card border border-border hover:border-border-hover transition-all duration-300 p-6"
            >
              <div className={clsx(
                "absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-10 -translate-y-1/2 translate-x-1/2",
                item.gradient === "green" && "bg-accent-green",
                item.gradient === "blue" && "bg-accent-blue",
                item.gradient === "purple" && "bg-accent-purple",
              )} />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <span className={clsx(
                    "text-xs font-medium uppercase tracking-wider",
                    item.gradient === "green" && "text-accent-green",
                    item.gradient === "blue" && "text-accent-blue",
                    item.gradient === "purple" && "text-accent-purple",
                  )}>
                    {item.bracket}
                  </span>
                  <span className={clsx(
                    "opacity-50",
                    item.gradient === "green" && "text-accent-green",
                    item.gradient === "blue" && "text-accent-blue",
                    item.gradient === "purple" && "text-accent-purple",
                  )}>
                    {item.icon}
                  </span>
                </div>
                <p className="text-2xl font-bold text-text-primary mb-0.5">{item.rate}</p>
                <p className="text-text-muted text-xs mb-3">{item.period}</p>
                <div className="w-full h-1.5 rounded-full bg-bg-secondary overflow-hidden">
                  <div
                    className={clsx(
                      "h-full rounded-full transition-all duration-700",
                      item.gradient === "green" && "bg-accent-green",
                      item.gradient === "blue" && "bg-accent-blue",
                      item.gradient === "purple" && "bg-accent-purple",
                    )}
                    style={{ width: `${item.barPct}%` }}
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Security Checks */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Lock className="w-5 h-5 text-text-muted" />
          <h2 className="text-base font-semibold text-text-primary">{t("risk.securityValidation")}</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <GlassCard>
            <h3 className="text-text-primary font-semibold text-sm mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-accent-blue" />
              {t("risk.marketRequirements")}
            </h3>
            <div className="space-y-2">
              <SecurityCheck label={t("risk.marketChecks.0")} passed={true} />
              <SecurityCheck label={t("risk.marketChecks.1")} passed={true} />
              <SecurityCheck label={t("risk.marketChecks.2")} passed={true} />
              <SecurityCheck label={t("risk.marketChecks.3")} passed={true} />
            </div>
          </GlassCard>

          <GlassCard>
            <h3 className="text-text-primary font-semibold text-sm mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-accent-green" />
              {t("risk.contractVerifications")}
            </h3>
            <div className="space-y-2">
              <SecurityCheck label={t("risk.contractChecks.0")} passed={true} />
              <SecurityCheck label={t("risk.contractChecks.1")} passed={true} />
              <SecurityCheck label={t("risk.contractChecks.2")} passed={true} />
              <SecurityCheck label={t("risk.contractChecks.3")} passed={true} />
            </div>
          </GlassCard>
        </div>
      </section>
    </div>
  );
}
