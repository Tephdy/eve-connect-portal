import { TrendingUp, TrendingDown, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Sparkline } from "./sparkline";

type Accent = "brand" | "green" | "yellow" | "red" | "purple" | "coral" | "mint" | "sky" | "lavender";

const ACCENTS: Record<
  Accent,
  { bg: string; text: string; spark: string; badge: string }
> = {
  brand:    { bg: "from-brand-500/15 to-brand-500/5",       text: "text-brand-700 dark:text-brand-300",     spark: "#3b6fff", badge: "bg-brand-500 text-white" },
  green:    { bg: "from-vivid-mint/30 to-vivid-mint/5",     text: "text-emerald-800 dark:text-emerald-200", spark: "#10b981", badge: "bg-emerald-500 text-white" },
  yellow:   { bg: "from-vivid-yellow/40 to-vivid-yellow/10",text: "text-amber-900 dark:text-amber-200",     spark: "#eab308", badge: "bg-amber-500 text-white" },
  red:      { bg: "from-vivid-rose/30 to-vivid-rose/5",     text: "text-rose-800 dark:text-rose-200",       spark: "#f43f5e", badge: "bg-rose-500 text-white" },
  purple:   { bg: "from-vivid-lavender/40 to-vivid-lavender/5", text: "text-purple-800 dark:text-purple-200", spark: "#a855f7", badge: "bg-purple-500 text-white" },
  coral:    { bg: "from-vivid-coral/30 to-vivid-coral/5",   text: "text-orange-800 dark:text-orange-200",   spark: "#ff8c69", badge: "bg-orange-500 text-white" },
  mint:     { bg: "from-vivid-mint/40 to-vivid-mint/10",    text: "text-emerald-800 dark:text-emerald-200", spark: "#7fe0b1", badge: "bg-emerald-500 text-white" },
  sky:      { bg: "from-vivid-sky/40 to-vivid-sky/10",      text: "text-sky-800 dark:text-sky-200",         spark: "#7cc7ff", badge: "bg-sky-500 text-white" },
  lavender: { bg: "from-vivid-lavender/50 to-vivid-lavender/10", text: "text-violet-800 dark:text-violet-200", spark: "#c7a8ff", badge: "bg-violet-500 text-white" },
};

export function StatCard({
  label,
  value,
  delta,
  deltaLabel = "vs last period",
  sparkline,
  accent = "brand",
  icon: Icon,
  className,
}: {
  label: string;
  value: string | number;
  delta?: number;
  deltaLabel?: string;
  sparkline?: number[];
  accent?: Accent;
  icon?: LucideIcon;
  className?: string;
}) {
  const a = ACCENTS[accent];
  const positive = (delta ?? 0) >= 0;

  return (
    <div
      className={cn(
        "glass group relative overflow-hidden rounded-2xl p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg",
        className
      )}
    >
      {/* Vivid gradient backdrop */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-90",
          a.bg
        )}
      />

      <div className="relative space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            {Icon && (
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/50 backdrop-blur-sm dark:bg-white/10">
                <Icon className={cn("h-4 w-4", a.text)} />
              </div>
            )}
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-600 dark:text-ink-500">
              {label}
            </p>
          </div>

          {delta !== undefined && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold",
                positive ? "bg-emerald-500/90 text-white" : "bg-rose-500/90 text-white"
              )}
            >
              {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {positive ? "+" : ""}
              {delta.toFixed(1)}%
            </span>
          )}
        </div>

        <p className={cn("text-3xl font-bold tracking-tight text-ink-900")}>
          {value}
        </p>

        {sparkline && sparkline.length > 0 && (
          <div className="-mx-1">
            <Sparkline data={sparkline} color={a.spark} height={36} />
          </div>
        )}

        {delta !== undefined && (
          <p className="text-xs text-ink-500">{deltaLabel}</p>
        )}
      </div>
    </div>
  );
}
