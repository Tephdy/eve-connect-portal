"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const PAYMENT_TYPES = [
  { value: "all", label: "All types" },
  { value: "rent", label: "Rent" },
  { value: "utility", label: "Utility" },
  { value: "deposits", label: "Deposits" },
  { value: "overdue", label: "Overdue" },
  { value: "add-ons", label: "Add-ons" },
  { value: "others", label: "Others" },
];

export function ReceiptFilters({
  properties,
}: {
  properties: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [q, setQ] = useState(sp.get("q") ?? "");

  const property = sp.get("property") ?? "all";
  const payment = sp.get("payment") ?? "all";
  const month = sp.get("month") ?? "";

  // Debounced search
  useEffect(() => {
    const current = sp.get("q") ?? "";
    if (q === current) return;
    const t = setTimeout(() => {
      const params = new URLSearchParams(sp.toString());
      if (q.trim()) params.set("q", q.trim());
      else params.delete("q");
      router.replace(pathname + "?" + params.toString(), { scroll: false });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function update(key: string, value: string | null) {
    const params = new URLSearchParams(sp.toString());
    if (value && value !== "all" && value !== "") params.set(key, value);
    else params.delete(key);
    router.replace(pathname + "?" + params.toString(), { scroll: false });
  }

  function clearAll() {
    setQ("");
    router.replace(pathname, { scroll: false });
  }

  const hasFilters =
    property !== "all" ||
    payment !== "all" ||
    month !== "" ||
    q.trim() !== "";

  return (
    <div className="glass space-y-3 rounded-2xl p-3">
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search tenant, unit, property..."
            className={cn(
              "w-full rounded-lg border border-white/60 bg-white/70 py-1.5 pl-9 pr-8 text-sm",
              "placeholder:text-ink-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20",
              "dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-ink-100"
            )}
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-400 hover:text-ink-700"
              aria-label="Clear search"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Property */}
        <select
          value={property}
          onChange={(e) => update("property", e.target.value)}
          className="rounded-lg border border-white/60 bg-white/70 px-3 py-1.5 text-sm dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-ink-100"
        >
          <option value="all">All properties</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        {/* Month */}
        <input
          type="month"
          value={month}
          onChange={(e) => update("month", e.target.value)}
          className="rounded-lg border border-white/60 bg-white/70 px-3 py-1.5 text-sm dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-ink-100"
          title="Filter by month folder"
        />

        {hasFilters && (
          <button
            onClick={clearAll}
            className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-medium text-brand-600 transition-colors hover:bg-brand-500/10 dark:text-brand-400"
          >
            <X className="h-3 w-3" />
            Clear all
          </button>
        )}
      </div>

      {/* Payment type chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-semibold text-ink-500">Payment type:</span>
        {PAYMENT_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => update("payment", t.value)}
            className={cn(
              "rounded-lg px-2.5 py-1 text-xs font-semibold transition-all",
              payment === t.value
                ? "bg-brand-gradient text-white shadow-sm shadow-brand-500/30"
                : "text-ink-600 hover:bg-white/60 dark:hover:bg-white/[0.06]"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
