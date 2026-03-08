import clsx from "clsx";

type RiskLevel = "safe" | "medium" | "high";

type RiskIndicatorProps = {
  healthFactor: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
};

function getRiskLevel(healthFactor: number): RiskLevel {
  if (healthFactor >= 1.5) return "safe";
  if (healthFactor >= 1.2) return "medium";
  return "high";
}

const riskConfig: Record<RiskLevel, { label: string; dot: string; text: string; bg: string; border: string }> = {
  safe: {
    label: "Safe",
    dot: "bg-accent-green",
    text: "text-accent-green",
    bg: "bg-accent-green/10",
    border: "border-accent-green/20",
  },
  medium: {
    label: "Medium",
    dot: "bg-accent-yellow",
    text: "text-accent-yellow",
    bg: "bg-accent-yellow/10",
    border: "border-accent-yellow/20",
  },
  high: {
    label: "High Risk",
    dot: "bg-accent-red",
    text: "text-accent-red",
    bg: "bg-accent-red/10",
    border: "border-accent-red/20",
  },
};

const sizeStyles = {
  sm: { dot: "h-1.5 w-1.5", text: "text-xs", gap: "gap-1", padding: "px-1.5 py-0.5" },
  md: { dot: "h-2 w-2", text: "text-sm", gap: "gap-1.5", padding: "px-2 py-1" },
  lg: { dot: "h-2.5 w-2.5", text: "text-base", gap: "gap-2", padding: "px-3 py-1.5" },
};

export function RiskIndicator({ healthFactor, size = "md", showLabel = true }: RiskIndicatorProps) {
  const level = getRiskLevel(healthFactor);
  const config = riskConfig[level];
  const sizes = sizeStyles[size];

  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border font-medium",
        config.bg,
        config.border,
        config.text,
        sizes.gap,
        sizes.padding,
        sizes.text
      )}
    >
      <span className={clsx("rounded-full shrink-0", config.dot, sizes.dot)} />
      {showLabel && <span>{config.label}</span>}
      <span className="opacity-70">{(healthFactor * 100).toFixed(0)}%</span>
    </span>
  );
}
