"use client";

import { motion } from "framer-motion";
import clsx from "clsx";
import { type ReactNode } from "react";

type GlassCardProps = {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  padding?: "sm" | "md" | "lg";
};

export function GlassCard({ children, className, hover = true, padding = "md" }: GlassCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={clsx(
        "rounded-xl bg-bg-card border border-border",
        hover && "hover:border-border-hover transition-all duration-300",
        padding === "sm" && "p-3",
        padding === "md" && "p-4",
        padding === "lg" && "p-5",
        className
      )}
    >
      {children}
    </motion.div>
  );
}
