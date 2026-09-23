"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { X } from "lucide-react";

export function ForecastFilters({
  properties,
}: {
  properties: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const property = sp.get("property") ?? "all";

  function update(value: string | null) {
    const params = new URLSearchParams(sp.toString());
    if (value && value !== "all") params.set("property", value);
    else params.delete("property");
    router.replace(pathname + "?" + params.toString(), { scroll: false });
  }

  return (
    <div className="glass flex flex-wrap items-center gap-3 rounded-2xl p-3">
      <span className="text-xs font-semibold text-ink-500">Property:</span>
      <select
        value={property}
        onChange={(e) => update(e.target.value)}
        className="rounded-lg border border-white/60 bg-white/70 px-3 py-1.5 text-sm dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-ink-100"
      >
        <option value="all">All properties</option>
        {properties.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      {property !== "all" && (
        <button
          onClick={() => update(null)}
          className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-medium text-brand-600 transition-colors hover:bg-brand-500/10 dark:text-brand-400"
        >
          <X className="h-3 w-3" />
          Clear
        </button>
      )}
    </div>
  );
}
