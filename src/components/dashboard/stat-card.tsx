import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Card, CardBody } from "@/components/ui/card";
import { Sparkline } from "./sparkline";

export function StatCard({
  label,
  value,
  delta,
  deltaLabel = "vs last period",
  sparkline,
  accent = "brand",
  className,
}: {
  label: string;
  value: string | number;
  delta?: number;
  deltaLabel?: string;
  sparkline?: number[];
  accent?: "brand" | "green" | "yellow" | "red" | "purple";
  className?: string;
}) {
  const ACCENT = {
    brand:  { ring: "ring-brand-500/20",   text: "text-brand-600 dark:text-brand-400",     fill: "#3b6fff" },
    green:  { ring: "ring-success-500/20", text: "text-success-700 dark:text-success-500", fill: "#10b981" },
    yellow: { ring: "ring-warning-500/20", text: "text-warning-700 dark:text-warning-500", fill: "#f59e0b" },
    red:    { ring: "ring-danger-500/20",  text: "text-danger-700 dark:text-danger-500",   fill: "#ef4444" },
    purple: { ring: "ring-purple-500/20",  text: "text-purple-700 dark:text-purple-400",   fill: "#a855f7" },
  }[accent];

  const positive = (delta ?? 0) >= 0;

  return (
    <Card interactive className={cn("overflow-hidden", className)}>
      <CardBody className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-wider text-ink-500">
            {label}
          </p>
          {delta !== undefined && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold",
                positive
                  ? "bg-success-100 text-success-700 dark:bg-success-500/15 dark:text-success-500"
                  : "bg-danger-100 text-danger-700 dark:bg-danger-500/15 dark:text-danger-500"
              )}
            >
              {positive ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {positive ? "+" : ""}
              {delta.toFixed(1)}%
            </span>
          )}
        </div>

        <p className={cn("text-2xl font-semibold tracking-tight text-ink-900")}>
          {value}
        </p>

        {sparkline && sparkline.length > 0 && (
          <div className="-mx-1">
            <Sparkline data={sparkline} color={ACCENT.fill} height={36} />
          </div>
        )}

        {delta !== undefined && (
          <p className="text-xs text-ink-500">{deltaLabel}</p>
        )}
      </CardBody>
    </Card>
  );
}
