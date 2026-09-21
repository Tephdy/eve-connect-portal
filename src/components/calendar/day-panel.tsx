"use client";

import { X, CalendarDays } from "lucide-react";
import { EventChip } from "./event-chip";
import type { CalendarEvent } from "@/lib/calendar/types";

function formatDay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function DayPanel({
  date,
  events,
  onClose,
  onPreview,
}: {
  date: string | null;
  events: CalendarEvent[];
  onClose: () => void;
  onPreview: (e: CalendarEvent) => void;
}) {
  if (!date) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-ink-200 bg-surface shadow-lg dark:border-white/[0.06]">
      <div className="flex items-center justify-between border-b border-ink-200 px-5 py-4 dark:border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400">
            <CalendarDays className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-ink-900">
              {formatDay(date)}
            </p>
            <p className="text-xs text-ink-500">
              {events.length === 0
                ? "No events"
                : events.length + " event" + (events.length === 1 ? "" : "s")}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-white/[0.05]"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <CalendarDays className="h-8 w-8 text-ink-300 dark:text-ink-400" />
            <p className="text-sm text-ink-500">Nothing scheduled</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {events.map((e) => (
              <li key={e.id}>
                <EventChip event={e} variant="full" onPreview={onPreview} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
