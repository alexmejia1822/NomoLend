"use client";

import { type ReactNode } from "react";
import { GlassCard } from "./GlassCard";

type ChartCardProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
};

export function ChartCard({ title, subtitle, children, className }: ChartCardProps) {
  return (
    <GlassCard padding="md" className={className}>
      <div className="mb-4">
        <h3 className="text-sm font-bold text-text-primary">{title}</h3>
        {subtitle && (
          <p className="text-text-muted text-xs mt-0.5">{subtitle}</p>
        )}
      </div>
      {children}
    </GlassCard>
  );
}
