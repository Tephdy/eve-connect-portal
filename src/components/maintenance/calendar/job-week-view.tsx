"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils/cn";
import { JobEventChip } from "./job-event-chip";
import type { JobCalendarEvent, JobCalendarMonth } from "@/lib/maintenance/calendar-types";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function ymd(y: number, m: number, d: number) {
  return y + "-" + pad2(m) + "-" + pad2(d);
}

export function JobWeekView({
  month,
  anchorDate,
  onPreview,
}: {
  month: JobCalendarMonth;
  anchorDate: string;
  onPreview: (e: JobCalendarEvent) => void;
}) {
  const days = useMemo(() => {
    const [y, m, d] = anchorDate.split("-").map(Number);
    const anchor = new Date(y, m - 1, d);
    const dayOfWeek = anchor.getDay();

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

  const todayYmd = ymd(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate());

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

              <div className="flex-1 space-y-1 p-2">
                {events.length === 0 ? (
                  <p className="py-8 text-center text-[10px] text-ink-400">—</p>
                ) : (
                  events.map((e) => (
                    <JobEventChip key={e.id} event={e} variant="compact" onPreview={onPreview} />
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
