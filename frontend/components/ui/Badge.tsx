import clsx from "clsx";

type BadgeProps = {
  children: React.ReactNode;
  variant?: "success" | "warning" | "danger" | "info" | "muted";
  size?: "sm" | "md";
  className?: string;
};

export function Badge({ children, variant = "info", size = "sm", className }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center font-medium rounded-full",
        className,
        size === "sm" && "px-2 py-0.5 text-xs",
        size === "md" && "px-3 py-1 text-sm",
        variant === "success" && "bg-accent-green/10 text-accent-green border border-accent-green/20",
        variant === "warning" && "bg-accent-yellow/10 text-accent-yellow border border-accent-yellow/20",
        variant === "danger" && "bg-accent-red/10 text-accent-red border border-accent-red/20",
        variant === "info" && "bg-accent-blue/10 text-accent-blue border border-accent-blue/20",
        variant === "muted" && "bg-bg-secondary text-text-muted border border-border",
      )}
    >
      {children}
    </span>
  );
}
