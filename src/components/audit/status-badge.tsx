import { cn } from "@/lib/utils/cn";
import type { FindingStatus } from "@/lib/audit/types";

const STYLES: Record<FindingStatus, string> = {
  open:          "bg-rose-500/15 text-rose-700 dark:bg-rose-500/25 dark:text-rose-200",
  investigating: "bg-amber-400/25 text-amber-900 dark:bg-amber-500/20 dark:text-amber-100",
  resolved:      "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/25 dark:text-emerald-200",
  dismissed:     "bg-ink-200/60 text-ink-600 dark:bg-white/[0.06] dark:text-ink-300",
};

const LABELS: Record<FindingStatus, string> = {
  open: "Open",
  investigating: "Investigating",
  resolved: "Resolved",
  dismissed: "Dismissed",
};

export function StatusBadge({ status, className }: { status: FindingStatus; className?: string }) {
  return (
    <span className={cn(
      "inline-flex items-center rounded-lg px-2 py-0.5 text-[11px] font-semibold backdrop-blur-sm",
      STYLES[status],
      className
    )}>
      {LABELS[status]}
    </span>
  );
}
