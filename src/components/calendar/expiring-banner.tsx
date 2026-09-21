import Link from "next/link";
import { AlertCircle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function ExpiringBanner({
  count,
  days,
  href,
}: {
  count: number;
  days: number;
  href: string;
}) {
  if (count === 0) return null;

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center justify-between gap-4 rounded-xl border border-warning-500/30 bg-warning-500/5 px-4 py-3 transition-colors hover:bg-warning-500/10",
        "dark:border-warning-500/20 dark:bg-warning-500/[0.06] dark:hover:bg-warning-500/10"
      )}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-warning-500/15 text-warning-700 dark:text-warning-500">
          <AlertCircle className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-medium text-ink-900">
            {count} lease{count === 1 ? "" : "s"} expiring within {days} days
          </p>
          <p className="text-xs text-ink-500">
            Review and reach out for renewals before they lapse
          </p>
        </div>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-warning-700 dark:text-warning-500" />
    </Link>
  );
}
