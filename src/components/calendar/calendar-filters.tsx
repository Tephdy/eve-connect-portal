"use client";

import { Filter } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Badge } from "@/components/ui/badge";
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
}: {
  properties: { id: string; name: string }[];
  selectedProperty: string | null;
  onPropertyChange: (id: string | null) => void;
  selectedTypes: CalendarEventType[];
  onTypesChange: (types: CalendarEventType[]) => void;
}) {
  function toggleType(t: CalendarEventType) {
    const set = new Set(selectedTypes);
    if (set.has(t)) set.delete(t);
    else set.add(t);
    onTypesChange(Array.from(set));
  }

  const allActive = selectedTypes.length === 0;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-ink-200 bg-surface px-4 py-3 dark:border-white/[0.06]">
      <div className="flex items-center gap-2 text-xs font-medium text-ink-500">
        <Filter className="h-3.5 w-3.5" />
        Filters
      </div>

      {/* Property selector */}
      <select
        value={selectedProperty ?? ""}
        onChange={(e) => onPropertyChange(e.target.value || null)}
        className="h-8 rounded-md border border-ink-200 bg-surface px-2.5 text-sm text-ink-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-white/[0.06]"
      >
        <option value="">All properties</option>
        {properties.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      <div className="mx-1 h-5 w-px bg-ink-200 dark:bg-white/[0.08]" />

      {/* Event type toggles */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => onTypesChange([])}
          className={cn(
            "rounded-md px-2 py-1 text-xs font-medium transition-colors",
            allActive
              ? "bg-brand-500 text-white"
              : "text-ink-600 hover:bg-ink-100 dark:hover:bg-white/[0.05]"
          )}
        >
          All
        </button>
        {ALL_TYPES.map((t) => {
          const active = selectedTypes.includes(t);
          return (
            <button
              key={t}
              onClick={() => toggleType(t)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                active
                  ? TYPE_COLORS[t].bg + " " + TYPE_COLORS[t].text
                  : "text-ink-500 hover:bg-ink-100 dark:hover:bg-white/[0.05]"
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
