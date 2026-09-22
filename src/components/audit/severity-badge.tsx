import { cn } from "@/lib/utils/cn";
import type { Severity } from "@/lib/audit/types";

const STYLES: Record<Severity, string> = {
  critical: "bg-rose-500/15 text-rose-700 dark:bg-rose-500/25 dark:text-rose-200 ring-1 ring-rose-500/30",
  high:     "bg-amber-400/25 text-amber-900 dark:bg-amber-500/20 dark:text-amber-100 ring-1 ring-amber-500/30",
  medium:   "bg-sky-500/15 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200 ring-1 ring-sky-500/30",
  low:      "bg-ink-200/60 text-ink-600 dark:bg-white/[0.06] dark:text-ink-300 ring-1 ring-white/20",
};

export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  return (
    <span className={cn(
      "inline-flex items-center rounded-lg px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider backdrop-blur-sm",
      STYLES[severity],
      className
    )}>
      {severity}
    </span>
  );
}
