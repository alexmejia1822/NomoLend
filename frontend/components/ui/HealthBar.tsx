"use client";

import clsx from "clsx";

type HealthBarProps = {
  value: number; // health factor (1.0 = 100%)
  showLabel?: boolean;
  size?: "sm" | "md";
};

export function HealthBar({ value, showLabel = true, size = "md" }: HealthBarProps) {
  const pct = Math.min(Math.max((value - 1) * 100, 0), 100);
  const color = value >= 1.5 ? "bg-accent-green" : value >= 1.2 ? "bg-accent-yellow" : value >= 1.0 ? "bg-orange-500" : "bg-accent-red";
  const label = value >= 1.5 ? "Saludable" : value >= 1.2 ? "Moderado" : value >= 1.0 ? "En riesgo" : "Liquidable";

  return (
    <div className="w-full">
      <div className={clsx("w-full rounded-full bg-bg-secondary overflow-hidden", size === "sm" ? "h-1.5" : "h-2.5")}>
        <div
          className={clsx("h-full rounded-full transition-all duration-500", color)}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      {showLabel && (
        <div className="flex justify-between mt-1">
          <span className={clsx("text-xs", color.replace("bg-", "text-"))}>{label}</span>
          <span className="text-xs text-text-muted">{value.toFixed(2)}x</span>
        </div>
      )}
    </div>
  );
}
