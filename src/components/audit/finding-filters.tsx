"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const STATUSES = ["all", "open", "investigating", "resolved", "dismissed"];
const SEVERITIES = ["all", "critical", "high", "medium", "low"];

export function FindingFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const status = sp.get("status") ?? "all";
  const severity = sp.get("severity") ?? "all";

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(sp.toString());
    if (value && value !== "all") params.set(key, value);
    else params.delete(key);
    router.replace(pathname + "?" + params.toString(), { scroll: false });
  }

  function clearAll() {
    router.replace(pathname, { scroll: false });
  }

  const hasFilters = status !== "all" || severity !== "all";

  return (
    <div className="glass flex flex-wrap items-center gap-3 rounded-2xl p-3">
      <span className="text-xs font-semibold text-ink-500">Status:</span>
      {STATUSES.map((s) => (
        <button
          key={s}
          onClick={() => updateParam("status", s === "all" ? null : s)}
          className={cn(
            "rounded-lg px-2.5 py-1 text-xs font-semibold capitalize transition-all",
            status === s
              ? "bg-brand-gradient text-white shadow-sm shadow-brand-500/30"
              : "text-ink-600 hover:bg-white/60 dark:hover:bg-white/[0.06]"
          )}
        >
          {s}
        </button>
      ))}
      <div className="mx-1 h-5 w-px bg-white/60 dark:bg-white/[0.08]" />
      <span className="text-xs font-semibold text-ink-500">Severity:</span>
      {SEVERITIES.map((s) => (
        <button
          key={s}
          onClick={() => updateParam("severity", s === "all" ? null : s)}
          className={cn(
            "rounded-lg px-2.5 py-1 text-xs font-semibold capitalize transition-all",
            severity === s
              ? s === "critical"
                ? "bg-rose-500 text-white shadow-sm shadow-rose-500/30"
                : s === "high"
                ? "bg-amber-500 text-white shadow-sm shadow-amber-500/30"
                : "bg-brand-gradient text-white shadow-sm shadow-brand-500/30"
              : "text-ink-600 hover:bg-white/60 dark:hover:bg-white/[0.06]"
          )}
        >
          {s}
        </button>
      ))}
      {hasFilters && (
        <button
          onClick={clearAll}
          className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-medium text-brand-600 transition-colors hover:bg-brand-500/10 dark:text-brand-400"
        >
          <X className="h-3 w-3" />
          Clear
        </button>
      )}
    </div>
  );
}
