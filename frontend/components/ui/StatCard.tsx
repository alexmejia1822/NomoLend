"use client";

import { motion } from "framer-motion";
import { type ReactNode } from "react";
import clsx from "clsx";

type StatCardProps = {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  trend?: { value: string; positive: boolean };
  gradient?: "blue" | "green" | "purple" | "cyan";
  className?: string;
};

export function StatCard({ title, value, subtitle, icon, trend, gradient, className }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={clsx(
        "relative overflow-hidden rounded-xl p-4",
        "bg-bg-card border border-border",
        "hover:border-border-hover transition-all duration-300",
        className
      )}
    >
      {gradient && (
        <div className={clsx(
          "absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl opacity-10 -translate-y-1/2 translate-x-1/2",
          gradient === "blue" && "bg-accent-blue",
          gradient === "green" && "bg-accent-green",
          gradient === "purple" && "bg-accent-purple",
          gradient === "cyan" && "bg-accent-cyan",
        )} />
      )}
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-2">
          <span className="text-text-secondary text-[11px] font-medium uppercase tracking-wider">{title}</span>
          {icon && <span className="text-text-muted">{icon}</span>}
        </div>
        <p className="text-xl font-bold text-text-primary">{value}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {subtitle && <span className="text-text-muted text-xs">{subtitle}</span>}
          {trend && (
            <span className={clsx("text-xs font-medium", trend.positive ? "text-accent-green" : "text-accent-red")}>
              {trend.positive ? "+" : ""}{trend.value}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
