"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const TYPES = [
  { value: "all", label: "All utilities" },
  { value: "electricity", label: "Electricity" },
  { value: "water", label: "Water" },
  { value: "gas", label: "Gas" },
  { value: "other", label: "Other" },
];

export function MeterFilters({
  properties,
}: {
  properties: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const property = sp.get("property") ?? "all";
  const utilityType = sp.get("utility_type") ?? "all";

  function update(key: string, value: string | null) {
    const params = new URLSearchParams(sp.toString());
    if (value && value !== "all") params.set(key, value);
    else params.delete(key);
    router.replace(pathname + "?" + params.toString(), { scroll: false });
  }

  function clearAll() {
    router.replace(pathname, { scroll: false });
  }

  const hasFilters = property !== "all" || utilityType !== "all";

  return (
    <div className="glass flex flex-wrap items-center gap-3 rounded-2xl p-3">
      <span className="text-xs font-semibold text-ink-500">Property:</span>
      <select
        value={property}
        onChange={(e) => update("property", e.target.value)}
        className="rounded-lg border border-white/60 bg-white/70 px-3 py-1.5 text-sm dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-ink-100"
      >
        <option value="all">All properties</option>
        {properties.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      <span className="text-xs font-semibold text-ink-500">Utility:</span>
      {TYPES.map((t) => (
        <button
          key={t.value}
          onClick={() =>
            update("utility_type", t.value === "all" ? null : t.value)
          }
          className={cn(
            "rounded-lg px-2.5 py-1 text-xs font-semibold transition-all",
            utilityType === t.value
              ? "bg-brand-gradient text-white shadow-sm shadow-brand-500/30"
              : "text-ink-600 hover:bg-white/60 dark:hover:bg-white/[0.06]"
          )}
        >
          {t.label}
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
