"use client";

import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import clsx from "clsx";
import { useTranslation } from "@/i18n/context";
import { ProtocolFlow } from "@/components/protocol/ProtocolFlow";
import {
  Landmark,
  BookOpen,
  ArrowRight,
  ArrowDown,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Database,
  BarChart3,
  Eye,
  Clock,
  Zap,
  Bot,
  Activity,
  Bell,
  Lock,
  FileCheck,
  Layers,
  Coins,
  AlertTriangle,
  CheckCircle2,
  Settings,
  TrendingUp,
} from "lucide-react";

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

const staggerGrid = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

/* ------------------------------------------------------------------ */
/*  Flow Step                                                          */
/* ------------------------------------------------------------------ */

function FlowStep({
  icon,
  label,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  color: string;
}) {
  return (
    <div
      className={clsx(
        "flex flex-col items-center gap-2 px-4 py-3 rounded-xl border text-center min-w-[120px]",
        color
      )}
    >
      <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white/5">
        {icon}
      </div>
      <span className="text-xs font-medium text-text-primary leading-tight">
        {label}
      </span>
    </div>
  );
}

function FlowArrow() {
  return (
    <div className="flex items-center justify-center shrink-0">
      <ArrowRight className="w-5 h-5 text-text-muted hidden md:block" />
      <ArrowDown className="w-5 h-5 text-text-muted md:hidden" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Module Card                                                        */
/* ------------------------------------------------------------------ */

function ModuleCard({
  icon,
  name,
  description,
}: {
  icon: React.ReactNode;
  name: string;
  description: string;
}) {
  return (
    <motion.div
      variants={itemVariants}
      className="rounded-lg bg-bg-secondary border border-border hover:border-border-hover p-4 transition-all duration-300 group"
    >
      <div className="w-8 h-8 rounded-lg bg-accent-blue/10 border border-accent-blue/20 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform duration-300">
        {icon}
      </div>
      <h3 className="text-sm font-bold text-text-primary mb-1">{name}</h3>
      <p className="text-xs text-text-muted leading-relaxed">{description}</p>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Risk Tier Card                                                     */
/* ------------------------------------------------------------------ */

const tierColors = {
  A: {
    bg: "bg-accent-green/10",
    border: "border-accent-green/20",
    text: "text-accent-green",
    badge: "success" as const,
  },
  B: {
    bg: "bg-accent-blue/10",
    border: "border-accent-blue/20",
    text: "text-accent-blue",
    badge: "info" as const,
  },
  C: {
    bg: "bg-accent-yellow/10",
    border: "border-accent-yellow/20",
    text: "text-accent-yellow",
    badge: "warning" as const,
  },
  D: {
    bg: "bg-accent-red/10",
    border: "border-accent-red/20",
    text: "text-accent-red",
    badge: "danger" as const,
  },
};

function TierCard({
  tier,
  ltv,
  liquidation,
  marketCap,
}: {
  tier: "A" | "B" | "C" | "D";
  ltv: string;
  liquidation: string;
  marketCap: string;
}) {
  const { t } = useTranslation();
  const c = tierColors[tier];
  return (
    <motion.div
      variants={itemVariants}
      className={clsx(
        "rounded-lg border p-4 transition-all duration-300 hover:scale-[1.02]",
        c.bg,
        c.border
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <span className={clsx("text-lg font-black", c.text)}>Tier {tier}</span>
        <Badge variant={c.badge} size="md">
          LTV {ltv}
        </Badge>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-muted">{t("protocol.maxLtv")}</span>
          <span className="font-semibold text-text-primary">{ltv}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-muted">{t("protocol.liquidation")}</span>
          <span className="font-semibold text-text-primary">{liquidation}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-muted">Market Cap</span>
          <span className="font-semibold text-text-primary">{marketCap}</span>
        </div>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Bot Card                                                           */
/* ------------------------------------------------------------------ */

function BotCard({
  icon,
  name,
  description,
}: {
  icon: React.ReactNode;
  name: string;
  description: string;
}) {
  return (
    <motion.div
      variants={itemVariants}
      className="flex items-start gap-3 rounded-lg bg-bg-secondary border border-border p-4 hover:border-border-hover transition-all duration-300"
    >
      <div className="w-8 h-8 rounded-lg bg-accent-purple/10 border border-accent-purple/20 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <h3 className="text-sm font-bold text-text-primary mb-1">{name}</h3>
        <p className="text-xs text-text-muted leading-relaxed">{description}</p>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Security Item                                                      */
/* ------------------------------------------------------------------ */

function SecurityItem({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <motion.div
      variants={itemVariants}
      className="flex items-start gap-3 p-4 rounded-lg bg-bg-secondary border border-border"
    >
      <div className="w-8 h-8 rounded-lg bg-accent-green/10 border border-accent-green/20 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <h3 className="text-sm font-bold text-text-primary mb-1">{title}</h3>
        <p className="text-xs text-text-muted leading-relaxed">{description}</p>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Protocol Page                                                      */
/* ------------------------------------------------------------------ */

export default function ProtocolPage() {
  const { t } = useTranslation();
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6 pb-8"
    >
      {/* ── 1. Hero ────────────────────────────────────────────────── */}
      <motion.section
        variants={itemVariants}
        className="relative overflow-hidden rounded-xl bg-bg-card border border-border p-6 md:p-8"
      >
        <div className="absolute top-0 left-1/4 w-72 h-72 bg-accent-blue/8 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-56 h-56 bg-accent-purple/8 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2.5 mb-4">
            <div className="w-9 h-9 rounded-lg bg-accent-blue/10 border border-accent-blue/20 flex items-center justify-center">
              <BookOpen className="w-4.5 h-4.5 text-accent-blue" />
            </div>
            <Badge variant="info" size="sm">
              Base Mainnet
            </Badge>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-text-primary mb-2">
            Nomo<span className="gradient-text">Lend</span> Protocol
          </h1>
          <p className="text-text-secondary text-sm leading-relaxed max-w-2xl mx-auto">
            {t("protocol.heroDesc")}
          </p>
        </div>
      </motion.section>

      {/* ── 2. How NomoLend Works (Animated Flow) ────────────────── */}
      <motion.section variants={itemVariants}>
        <GlassCard padding="md">
          <div className="text-center mb-5">
            <h2 className="text-lg font-bold text-text-primary mb-1">
              {t("protocol.howItWorks")}
            </h2>
            <p className="text-text-muted text-sm max-w-lg mx-auto">
              {t("protocol.howItWorksSub")}
            </p>
          </div>

          <ProtocolFlow />
        </GlassCard>
      </motion.section>

      {/* ── 3. Architecture ────────────────────────────────────────── */}
      <motion.section variants={itemVariants}>
        <GlassCard padding="md">
          <div className="text-center mb-5">
            <h2 className="text-lg font-bold text-text-primary mb-1">
              {t("protocol.architecture")}
            </h2>
            <p className="text-text-muted text-sm max-w-lg mx-auto">
              {t("protocol.architectureSub")}
            </p>
          </div>

          <motion.div
            variants={staggerGrid}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            <ModuleCard
              icon={<BookOpen className="w-5 h-5 text-accent-blue" />}
              name="OrderBook"
              description={t("protocol.modules.OrderBook")}
            />
            <ModuleCard
              icon={<Landmark className="w-5 h-5 text-accent-blue" />}
              name="LoanManager"
              description={t("protocol.modules.LoanManager")}
            />
            <ModuleCard
              icon={<Shield className="w-5 h-5 text-accent-blue" />}
              name="CollateralManager"
              description={t("protocol.modules.CollateralManager")}
            />
            <ModuleCard
              icon={<BarChart3 className="w-5 h-5 text-accent-blue" />}
              name="RiskEngine"
              description={t("protocol.modules.RiskEngine")}
            />
            <ModuleCard
              icon={<Eye className="w-5 h-5 text-accent-blue" />}
              name="PriceOracle"
              description={t("protocol.modules.PriceOracle")}
            />
            <ModuleCard
              icon={<Zap className="w-5 h-5 text-accent-blue" />}
              name="LiquidationEngine"
              description={t("protocol.modules.LiquidationEngine")}
            />
            <ModuleCard
              icon={<FileCheck className="w-5 h-5 text-accent-blue" />}
              name="TokenValidator"
              description={t("protocol.modules.TokenValidator")}
            />
            <ModuleCard
              icon={<Settings className="w-5 h-5 text-accent-blue" />}
              name="ProtocolConfig"
              description={t("protocol.modules.ProtocolConfig")}
            />
            <ModuleCard
              icon={<Database className="w-5 h-5 text-accent-blue" />}
              name="ReserveFund"
              description={t("protocol.modules.ReserveFund")}
            />
          </motion.div>
        </GlassCard>
      </motion.section>

      {/* ── 4. Risk Model ──────────────────────────────────────────── */}
      <motion.section variants={itemVariants}>
        <GlassCard padding="md">
          <div className="text-center mb-5">
            <h2 className="text-lg font-bold text-text-primary mb-1">
              {t("protocol.riskModel")}
            </h2>
            <p className="text-text-muted text-sm max-w-lg mx-auto">
              {t("protocol.riskModelSub")}
            </p>
          </div>

          <motion.div
            variants={staggerGrid}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            <TierCard
              tier="A"
              ltv="40%"
              liquidation="60%"
              marketCap=">$150M"
            />
            <TierCard
              tier="B"
              ltv="35%"
              liquidation="55%"
              marketCap=">$100M"
            />
            <TierCard
              tier="C"
              ltv="30%"
              liquidation="50%"
              marketCap=">$50M"
            />
            <TierCard
              tier="D"
              ltv="25%"
              liquidation="50%"
              marketCap=">$20M"
            />
          </motion.div>
        </GlassCard>
      </motion.section>

      {/* ── 5. Liquidation System ──────────────────────────────────── */}
      <motion.section variants={itemVariants}>
        <GlassCard padding="md">
          <div className="text-center mb-5">
            <h2 className="text-lg font-bold text-text-primary mb-1">
              {t("protocol.liquidationSystem")}
            </h2>
            <p className="text-text-muted text-sm max-w-lg mx-auto">
              {t("protocol.liquidationSystemSub")}
            </p>
          </div>

          {/* Explanation */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
            <div className="rounded-lg bg-accent-red/10 border border-accent-red/20 p-4 text-center">
              <AlertTriangle className="w-6 h-6 text-accent-red mx-auto mb-2" />
              <h3 className="text-sm font-bold text-text-primary mb-1">
                {t("protocol.liquidationTriggered")}
              </h3>
              <p className="text-xs text-text-muted">
                {t("protocol.liquidationTriggeredDesc")}
              </p>
            </div>
            <div className="rounded-lg bg-accent-blue/10 border border-accent-blue/20 p-4 text-center">
              <Coins className="w-6 h-6 text-accent-blue mx-auto mb-2" />
              <h3 className="text-sm font-bold text-text-primary mb-1">
                {t("protocol.lenderProtected")}
              </h3>
              <p className="text-xs text-text-muted">
                {t("protocol.lenderProtectedDesc")}
              </p>
            </div>
            <div className="rounded-lg bg-accent-green/10 border border-accent-green/20 p-4 text-center">
              <Database className="w-6 h-6 text-accent-green mx-auto mb-2" />
              <h3 className="text-sm font-bold text-text-primary mb-1">
                {t("protocol.feePenalty")}
              </h3>
              <p className="text-xs text-text-muted">
                {t("protocol.feePenaltyDesc")}
              </p>
            </div>
          </div>

          {/* Visual flow */}
          <div className="flex flex-col md:flex-row items-center justify-center gap-3">
            <FlowStep
              icon={<ShieldAlert className="w-5 h-5 text-accent-red" />}
              label={t("protocol.hfOrExpired")}
              color="bg-accent-red/10 border-accent-red/20"
            />
            <FlowArrow />
            <FlowStep
              icon={<Bot className="w-5 h-5 text-accent-purple" />}
              label={t("protocol.botSellsCollateral")}
              color="bg-accent-purple/10 border-accent-purple/20"
            />
            <FlowArrow />
            <FlowStep
              icon={<CheckCircle2 className="w-5 h-5 text-accent-green" />}
              label={t("protocol.debtPaidToLender")}
              color="bg-accent-green/10 border-accent-green/20"
            />
          </div>
        </GlassCard>
      </motion.section>

      {/* ── 6. Automation Bots ─────────────────────────────────────── */}
      <motion.section variants={itemVariants}>
        <GlassCard padding="md">
          <div className="text-center mb-5">
            <h2 className="text-lg font-bold text-text-primary mb-1">
              {t("protocol.automationBots")}
            </h2>
            <p className="text-text-muted text-sm max-w-lg mx-auto">
              {t("protocol.automationBotsSub")}
            </p>
          </div>

          <motion.div
            variants={staggerGrid}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <BotCard
              icon={<Clock className="w-5 h-5 text-accent-purple" />}
              name="Price Updater"
              description={t("protocol.priceUpdaterDesc")}
            />
            <BotCard
              icon={<Activity className="w-5 h-5 text-accent-purple" />}
              name="Health Monitor"
              description={t("protocol.healthMonitorDesc")}
            />
            <BotCard
              icon={<Zap className="w-5 h-5 text-accent-purple" />}
              name="Liquidation Bot"
              description={t("protocol.liquidationBotDesc")}
            />
            <BotCard
              icon={<Bell className="w-5 h-5 text-accent-purple" />}
              name="Monitor Bot"
              description={t("protocol.monitorBotDesc")}
            />
          </motion.div>
        </GlassCard>
      </motion.section>

      {/* ── 7. Security Model ──────────────────────────────────────── */}
      <motion.section variants={itemVariants}>
        <GlassCard padding="md">
          <div className="text-center mb-5">
            <h2 className="text-lg font-bold text-text-primary mb-1">
              {t("protocol.securityModel")}
            </h2>
            <p className="text-text-muted text-sm max-w-lg mx-auto">
              {t("protocol.securityModelSub")}
            </p>
          </div>

          <motion.div
            variants={staggerGrid}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <SecurityItem
              icon={<Lock className="w-5 h-5 text-accent-green" />}
              title={t("protocol.multisigTitle")}
              description={t("protocol.multisigDesc")}
            />
            <SecurityItem
              icon={<ShieldCheck className="w-5 h-5 text-accent-green" />}
              title="Role-based Access Control"
              description={t("protocol.rbacDesc")}
            />
            <SecurityItem
              icon={<FileCheck className="w-5 h-5 text-accent-green" />}
              title={t("protocol.verifiedTitle")}
              description={t("protocol.verifiedDesc")}
            />
            <SecurityItem
              icon={<Layers className="w-5 h-5 text-accent-green" />}
              title="Oracle Redundancy"
              description={t("protocol.oracleDesc")}
            />
          </motion.div>
        </GlassCard>
      </motion.section>

      {/* ── 8. CTA ─────────────────────────────────────────────────── */}
      <motion.section variants={itemVariants}>
        <div className="relative overflow-hidden rounded-xl bg-bg-card border border-border p-6 md:p-8">
          <div className="absolute top-0 left-1/4 w-72 h-72 bg-accent-blue/8 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-1/4 w-56 h-56 bg-accent-purple/8 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 text-center max-w-xl mx-auto">
            <h2 className="text-lg md:text-xl font-bold text-text-primary mb-2">
              {t("protocol.ctaTitle")}
            </h2>
            <p className="text-text-muted text-sm mb-5 leading-relaxed">
              {t("protocol.ctaDesc")}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/lend">
                <Button variant="primary" size="lg" className="gap-2 min-w-[200px]">
                  <TrendingUp className="w-4 h-4" />
                  {t("protocol.lendUsdc")}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link href="/borrow">
                <Button
                  variant="secondary"
                  size="lg"
                  className="gap-2 min-w-[200px] border-accent-purple/30 hover:border-accent-purple/50"
                >
                  <Coins className="w-4 h-4 text-accent-purple" />
                  {t("protocol.requestLoan")}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </motion.section>
    </motion.div>
  );
}
