"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, X, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "prospect", label: "Prospect" },
  { value: "former", label: "Former" },
  { value: "blacklisted", label: "Blacklisted" },
];

export function TenantFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const q = searchParams.get("q") ?? "";
  const status = searchParams.get("status") ?? "";
  const hasMessenger = searchParams.get("messenger") === "1";
  const hasEmail = searchParams.get("email") === "1";

  const [localQ, setLocalQ] = useState(q);

  // Debounce search
  useEffect(() => {
    const id = setTimeout(() => {
      if (localQ === q) return;
      updateParam("q", localQ || null);
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localQ]);

  // Sync when URL changes externally (back button)
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

  function toggleFlag(key: string, current: boolean) {
    const params = new URLSearchParams(searchParams.toString());
    if (current) params.delete(key);
    else params.set(key, "1");
    router.replace(pathname + "?" + params.toString(), { scroll: false });
  }

  function clearAll() {
    setLocalQ("");
    router.replace(pathname, { scroll: false });
  }

  const hasFilters = !!(q || status || hasMessenger || hasEmail);

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

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {/* Search */}
        <div className="relative md:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            type="text"
            value={localQ}
            onChange={(e) => setLocalQ(e.target.value)}
            placeholder="Search name, email, phone…"
            className="h-9 w-full rounded-md border border-ink-200 bg-surface pl-9 pr-3 text-sm text-ink-900 placeholder:text-ink-400 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-white/[0.06]"
          />
        </div>

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

      {/* Quick toggles */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-ink-500">Show:</span>
        <ToggleChip
          active={hasMessenger}
          onClick={() => toggleFlag("messenger", hasMessenger)}
        >
          Has messenger
        </ToggleChip>
        <ToggleChip
          active={hasEmail}
          onClick={() => toggleFlag("email", hasEmail)}
        >
          Has email
        </ToggleChip>
      </div>
    </div>
  );
}

function ToggleChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-brand-500 text-white"
          : "text-ink-600 hover:bg-ink-100 dark:hover:bg-white/[0.05]"
      )}
    >
      {children}
    </button>
  );
}
