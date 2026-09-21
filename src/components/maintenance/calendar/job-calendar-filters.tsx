"use client";

import { Filter, X } from "lucide-react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import {
  ALL_JOB_PRIORITIES,
  ALL_JOB_STATUSES,
  PRIORITY_LABELS,
  STATUS_TO_EVENT,
  JOB_EVENT_LABELS,
} from "@/lib/maintenance/calendar-types";

export function JobCalendarFilters({
  properties,
}: {
  properties: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const property = searchParams.get("property") ?? "";
  const statusesParam = searchParams.get("statuses") ?? "";
  const prioritiesParam = searchParams.get("priorities") ?? "";

  const selectedStatuses = statusesParam ? statusesParam.split(",") : [];
  const selectedPriorities = prioritiesParam ? prioritiesParam.split(",") : [];

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.replace(pathname + "?" + params.toString(), { scroll: false });
  }

  function toggleMulti(key: string, list: string[], value: string) {
    const set = new Set(list);
    if (set.has(value)) set.delete(value);
    else set.add(value);
    const arr = Array.from(set);
    updateParam(key, arr.length > 0 ? arr.join(",") : null);
  }

  function clearAll() {
    router.replace(pathname, { scroll: false });
  }

  const hasFilters = !!(property || statusesParam || prioritiesParam);

  return (
    <div className="space-y-3 rounded-xl border border-ink-200 bg-surface p-4 dark:border-white/[0.06]">
      <div className="flex items-center gap-2 text-xs font-medium text-ink-500">
        <Filter className="h-3.5 w-3.5" />
        Filters
        {hasFilters && (
          <button
            onClick={clearAll}
            className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs text-brand-600 transition-colors hover:bg-brand-500/10 dark:text-brand-400"
          >
            <X className="h-3 w-3" />
            Clear all
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {/* Property */}
        <select
          value={property}
          onChange={(e) => updateParam("property", e.target.value || null)}
          className="h-9 rounded-md border border-ink-200 bg-surface px-3 text-sm text-ink-800 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-white/[0.06]"
        >
          <option value="">All properties</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        {/* Priorities */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-ink-500">Priority:</span>
          {ALL_JOB_PRIORITIES.map((p) => (
            <button
              key={p}
              onClick={() => toggleMulti("priorities", selectedPriorities, p)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                selectedPriorities.includes(p)
                  ? p === "urgent"
                    ? "bg-danger-500 text-white"
                    : p === "high"
                    ? "bg-warning-500 text-white"
                    : "bg-brand-500 text-white"
                  : "text-ink-600 hover:bg-ink-100 dark:hover:bg-white/[0.05]"
              )}
            >
              {PRIORITY_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-ink-500">Status:</span>
        {ALL_JOB_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => toggleMulti("statuses", selectedStatuses, s)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              selectedStatuses.includes(s)
                ? "bg-brand-500 text-white"
                : "text-ink-600 hover:bg-ink-100 dark:hover:bg-white/[0.05]"
            )}
          >
            {JOB_EVENT_LABELS[STATUS_TO_EVENT[s]] ?? s}
          </button>
        ))}
      </div>
    </div>
  );
}
