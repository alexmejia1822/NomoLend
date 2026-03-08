"use client";

import { motion } from "framer-motion";
import { useTranslation } from "@/i18n/context";
import clsx from "clsx";
import {
  Wallet,
  FileText,
  Coins,
  ArrowDownToLine,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";

/* ── Animation variants ─── */

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15 },
  },
};

const stepVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.5, ease: "easeOut" as const },
  },
};

const arrowVariants = {
  hidden: { opacity: 0, scaleY: 0 },
  visible: {
    opacity: 1,
    scaleY: 1,
    transition: { duration: 0.3, ease: "easeOut" as const },
  },
};

/* ── Animated Arrow ─── */

function AnimatedArrow({ color = "accent-blue" }: { color?: string }) {
  return (
    <motion.div
      variants={arrowVariants}
      className="flex flex-col items-center py-1"
    >
      <div className={clsx("w-px h-8 bg-gradient-to-b", `from-${color}/60`, "to-transparent")} />
      <motion.div
        animate={{ y: [0, 4, 0] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <svg width="12" height="10" viewBox="0 0 12 10" fill="none" className={`text-${color}`}>
          <path d="M6 10L0 0h12L6 10z" fill="currentColor" opacity="0.6" />
        </svg>
      </motion.div>
    </motion.div>
  );
}

/* ── Step Card ─── */

function StepCard({
  icon,
  title,
  description,
  accentColor,
  glowColor,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  accentColor: string;
  glowColor: string;
}) {
  return (
    <motion.div
      variants={stepVariants}
      whileHover={{ scale: 1.02, y: -2 }}
      className="relative overflow-hidden rounded-xl bg-bg-card border border-border p-5 transition-all duration-300 group"
    >
      {/* Glow */}
      <div
        className={clsx(
          "absolute -top-8 -right-8 w-24 h-24 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500",
          glowColor
        )}
      />

      <div className="relative z-10 flex items-start gap-4">
        <div
          className={clsx(
            "w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border",
            accentColor
          )}
        >
          {icon}
        </div>
        <div>
          <h3 className="text-sm font-bold text-text-primary mb-1">{title}</h3>
          <p className="text-xs text-text-muted leading-relaxed">{description}</p>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Main Component ─── */

export function ProtocolFlow() {
  const { t } = useTranslation();
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-50px" }}
      className="max-w-lg mx-auto"
    >
      <StepCard
        icon={<Wallet className="w-5 h-5 text-accent-blue" />}
        title={t("protocol.flow.step1Title")}
        description={t("protocol.flow.step1Desc")}
        accentColor="bg-accent-blue/10 border-accent-blue/20"
        glowColor="bg-accent-blue/20"
      />

      <AnimatedArrow color="accent-blue" />

      <StepCard
        icon={<FileText className="w-5 h-5 text-accent-blue" />}
        title={t("protocol.flow.step2Title")}
        description={t("protocol.flow.step2Desc")}
        accentColor="bg-accent-blue/10 border-accent-blue/20"
        glowColor="bg-accent-blue/20"
      />

      <AnimatedArrow color="accent-purple" />

      <StepCard
        icon={<Coins className="w-5 h-5 text-accent-purple" />}
        title={t("protocol.flow.step3Title")}
        description={t("protocol.flow.step3Desc")}
        accentColor="bg-accent-purple/10 border-accent-purple/20"
        glowColor="bg-accent-purple/20"
      />

      <AnimatedArrow color="accent-purple" />

      <StepCard
        icon={<ArrowDownToLine className="w-5 h-5 text-accent-green" />}
        title={t("protocol.flow.step4Title")}
        description={t("protocol.flow.step4Desc")}
        accentColor="bg-accent-green/10 border-accent-green/20"
        glowColor="bg-accent-green/20"
      />

      <AnimatedArrow color="accent-green" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <motion.div variants={stepVariants}>
          <StepCard
            icon={<RefreshCw className="w-5 h-5 text-accent-green" />}
            title={t("protocol.flow.step5aTitle")}
            description={t("protocol.flow.step5aDesc")}
            accentColor="bg-accent-green/10 border-accent-green/20"
            glowColor="bg-accent-green/20"
          />
        </motion.div>

        <motion.div variants={stepVariants}>
          <StepCard
            icon={<AlertTriangle className="w-5 h-5 text-accent-red" />}
            title={t("protocol.flow.step5bTitle")}
            description={t("protocol.flow.step5bDesc")}
            accentColor="bg-accent-red/10 border-accent-red/20"
            glowColor="bg-accent-red/20"
          />
        </motion.div>
      </div>
    </motion.div>
  );
}
