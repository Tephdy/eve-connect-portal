"use client";

import { Filter, X } from "lucide-react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import {
  ALL_TYPES,
  TYPE_COLORS,
  TYPE_LABELS,
  type CalendarEventType,
} from "@/lib/calendar/types";

export function CalendarFilters({
  properties,
  selectedProperty,
  onPropertyChange,
  selectedTypes,
  onTypesChange,
  allowedTypes,
}: {
  properties: { id: string; name: string }[];
  selectedProperty: string | null;
  onPropertyChange: (id: string | null) => void;
  selectedTypes: CalendarEventType[];
  onTypesChange: (types: CalendarEventType[]) => void;
  allowedTypes?: CalendarEventType[];
}) {
  const types = allowedTypes ?? ALL_TYPES;

  function toggleType(t: CalendarEventType) {
    const set = new Set(selectedTypes);
    if (set.has(t)) set.delete(t);
    else set.add(t);
    onTypesChange(Array.from(set));
  }

  const allActive = selectedTypes.length === 0;

  return (
    <div className="glass flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-ink-500">
        <Filter className="h-3.5 w-3.5" />
        Filters
      </div>

      <select
        value={selectedProperty ?? ""}
        onChange={(e) => onPropertyChange(e.target.value || null)}
        className="h-8 rounded-lg border border-white/60 bg-white/60 px-2.5 text-sm text-ink-800 backdrop-blur-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-ink-200"
      >
        <option value="">All properties</option>
        {properties.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      <div className="mx-1 h-5 w-px bg-white/60 dark:bg-white/[0.08]" />

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => onTypesChange([])}
          className={cn(
            "rounded-lg px-2.5 py-1 text-xs font-semibold transition-all",
            allActive
              ? "bg-brand-gradient text-white shadow-sm shadow-brand-500/30"
              : "text-ink-600 hover:bg-white/60 dark:hover:bg-white/[0.06]"
          )}
        >
          All
        </button>
        {types.map((t) => {
          const active = selectedTypes.includes(t);
          return (
            <button
              key={t}
              onClick={() => toggleType(t)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all backdrop-blur-sm",
                active
                  ? TYPE_COLORS[t].bg + " " + TYPE_COLORS[t].text
                  : "text-ink-500 hover:bg-white/60 dark:hover:bg-white/[0.06]"
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", TYPE_COLORS[t].dot)} />
              {TYPE_LABELS[t]}
            </button>
          );
        })}
      </div>
    </div>
  );
}