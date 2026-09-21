"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils/cn";
import { DraggableChip } from "./draggable-chip";
import type { CalendarEvent, CalendarMonth } from "@/lib/calendar/types";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function ymd(y: number, m: number, d: number) {
  return y + "-" + pad2(m) + "-" + pad2(d);
}

/**
 * Given a reference date and events map, return the 7 days of that week
 * (Sunday → Saturday) and their events.
 */
export function WeekView({
  month,
  anchorDate,
  onPreview,
  onDropEvent,
}: {
  month: CalendarMonth;
  anchorDate: string; // YYYY-MM-DD
  onPreview: (e: CalendarEvent) => void;
  onDropEvent: (event: CalendarEvent, newDate: string) => void;
}) {
  const days = useMemo(() => {
    const [y, m, d] = anchorDate.split("-").map(Number);
    const anchor = new Date(y, m - 1, d);
    const dayOfWeek = anchor.getDay();

    // Start of week (Sunday)
    const start = new Date(anchor);
    start.setDate(anchor.getDate() - dayOfWeek);

    const out: { date: string; label: string; weekday: string; dayNumber: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const cur = new Date(start);
      cur.setDate(start.getDate() + i);
      out.push({
        date: ymd(cur.getFullYear(), cur.getMonth() + 1, cur.getDate()),
        label: cur.toLocaleDateString("en-PH", { month: "short", day: "numeric" }),
        weekday: cur.toLocaleDateString("en-PH", { weekday: "long" }),
        dayNumber: cur.getDate(),
      });
    }
    return out;
  }, [anchorDate]);

  const now = new Date();
  const todayYmd = ymd(now.getFullYear(), now.getMonth() + 1, now.getDate());

  return (
    <div className="overflow-hidden rounded-xl border border-ink-200 bg-surface dark:border-white/[0.06]">
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const events = month.eventsByDate[day.date] ?? [];
          const isToday = day.date === todayYmd;

          return (
            <div
              key={day.date}
              className={cn(
                "flex min-h-[400px] flex-col border-r border-ink-200 last:border-r-0 dark:border-white/[0.06]",
                isToday && "bg-brand-500/5"
              )}
            >
              {/* Day header */}
              <div
                className={cn(
                  "flex flex-col items-center gap-0.5 border-b border-ink-200 py-3 dark:border-white/[0.06]",
                  isToday && "bg-brand-500/10"
                )}
              >
                <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                  {day.weekday.slice(0, 3)}
                </span>
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold",
                    isToday ? "bg-brand-500 text-white" : "text-ink-900"
                  )}
                >
                  {day.dayNumber}
                </span>
                <span className="text-[10px] text-ink-400">{day.label}</span>
              </div>

              {/* Events */}
              <div
                className="flex-1 space-y-1 p-2"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const draggedId = e.dataTransfer.getData("text/plain");
                  // The month-grid controls drag state; we look it up
                  // by calling onDropEvent with a synthetic lookup.
                  // Simpler: delegate to parent — the chip has already
                  // set up the drag data.
                  const anyEvt = Object.values(month.eventsByDate)
                    .flat()
                    .find((x) => x.id === draggedId);
                  if (anyEvt) onDropEvent(anyEvt, day.date);
                }}
              >
                {events.length === 0 ? (
                  <p className="py-8 text-center text-[10px] text-ink-400">
                    —
                  </p>
                ) : (
                  events.map((e) => (
                    <DraggableChip
                      key={e.id}
                      event={e}
                      onPreview={onPreview}
                      onDragStart={() => {}}
                      onDragEnd={() => {}}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
