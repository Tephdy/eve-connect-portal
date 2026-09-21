"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, X, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "vacant", label: "Vacant" },
  { value: "occupied", label: "Occupied" },
  { value: "reserved", label: "Reserved" },
  { value: "maintenance", label: "Maintenance" },
  { value: "unavailable", label: "Unavailable" },
];

export function UnitFilters({
  properties,
  bedroomsOptions,
}: {
  properties: { id: string; name: string }[];
  bedroomsOptions: number[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const q = searchParams.get("q") ?? "";
  const property = searchParams.get("property") ?? "";
  const status = searchParams.get("status") ?? "";
  const bedrooms = searchParams.get("bedrooms") ?? "";

  const [localQ, setLocalQ] = useState(q);

  // Debounce search input
  useEffect(() => {
    const id = setTimeout(() => {
      if (localQ === q) return;
      updateParam("q", localQ || null);
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localQ]);

  // Sync localQ when URL changes externally (back button)
  useEffect(() => {
    if (q !== localQ) setLocalQ(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.replace(pathname + "?" + params.toString(), { scroll: false });
  }

  function clearAll() {
    setLocalQ("");
    router.replace(pathname, { scroll: false });
  }

  const hasFilters = !!(q || property || status || bedrooms);

  return (
    <div className="space-y-3 rounded-xl border border-ink-200 bg-surface p-4 dark:border-white/[0.06]">
      <div className="flex items-center gap-2 text-xs font-medium text-ink-500">
        <SlidersHorizontal className="h-3.5 w-3.5" />
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

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {/* Search */}
        <div className="relative md:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            type="text"
            value={localQ}
            onChange={(e) => setLocalQ(e.target.value)}
            placeholder="Search unit number…"
            className="h-9 w-full rounded-md border border-ink-200 bg-surface pl-9 pr-3 text-sm text-ink-900 placeholder:text-ink-400 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-white/[0.06]"
          />
        </div>

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

        {/* Status */}
        <select
          value={status}
          onChange={(e) => updateParam("status", e.target.value || null)}
          className="h-9 rounded-md border border-ink-200 bg-surface px-3 text-sm text-ink-800 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-white/[0.06]"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {bedroomsOptions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-ink-500">Bedrooms:</span>
          <button
            onClick={() => updateParam("bedrooms", null)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              !bedrooms
                ? "bg-brand-500 text-white"
                : "text-ink-600 hover:bg-ink-100 dark:hover:bg-white/[0.05]"
            )}
          >
            Any
          </button>
          {bedroomsOptions.map((n) => (
            <button
              key={n}
              onClick={() => updateParam("bedrooms", String(n))}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                bedrooms === String(n)
                  ? "bg-brand-500 text-white"
                  : "text-ink-600 hover:bg-ink-100 dark:hover:bg-white/[0.05]"
              )}
            >
              {n}BR
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
