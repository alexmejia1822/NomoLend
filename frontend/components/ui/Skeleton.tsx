import clsx from "clsx";

type SkeletonProps = {
  className?: string;
  variant?: "text" | "card" | "circle";
};

export function Skeleton({ className, variant = "text" }: SkeletonProps) {
  return (
    <div
      className={clsx(
        "skeleton",
        variant === "text" && "h-4 w-full",
        variant === "card" && "h-32 w-full rounded-2xl",
        variant === "circle" && "h-10 w-10 rounded-full",
        className
      )}
    />
  );
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-2xl bg-bg-card border border-border p-5">
      <Skeleton className="h-3 w-20 mb-3" />
      <Skeleton className="h-7 w-28 mb-2" />
      <Skeleton className="h-3 w-16" />
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
