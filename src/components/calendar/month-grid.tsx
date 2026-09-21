"use client";

import { cn } from "@/lib/utils/cn";
import { EventChip } from "./event-chip";
import type { CalendarEvent, CalendarMonth } from "@/lib/calendar/types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function ymd(y: number, m: number, d: number) {
  return y + "-" + pad2(m) + "-" + pad2(d);
}

export function MonthGrid({
  month,
  selectedDate,
  onSelectDate,
  onPreview,
}: {
  month: CalendarMonth;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  onPreview: (e: CalendarEvent) => void;
}) {
  const { year, month: m, eventsByDate } = month;
  const firstOfMonth = new Date(year, m - 1, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, m, 0).getDate();
  const daysInPrevMonth = new Date(year, m - 1, 0).getDate();

  const now = new Date();
  const todayYmd = ymd(now.getFullYear(), now.getMonth() + 1, now.getDate());

  const cells: { date: string; day: number; current: boolean }[] = [];

  for (let i = startWeekday - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    const prevMonth = m === 1 ? 12 : m - 1;
    const prevYear = m === 1 ? year - 1 : year;
    cells.push({ date: ymd(prevYear, prevMonth, day), day, current: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: ymd(year, m, d), day: d, current: true });
  }
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    const nextMonth = m === 12 ? 1 : m + 1;
    const nextYear = m === 12 ? year + 1 : year;
    cells.push({ date: ymd(nextYear, nextMonth, d), day: d, current: false });
  }

  return (
    <div className="overflow-hidden rounded-xl border border-ink-200 bg-surface dark:border-white/[0.06]">
      <div className="grid grid-cols-7 border-b border-ink-200 dark:border-white/[0.06]">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-ink-500"
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((cell, i) => {
          const events = eventsByDate[cell.date] ?? [];
          const isToday = cell.date === todayYmd;
          const isSelected = cell.date === selectedDate;

          return (
            <div
              key={i}
              role="button"
              tabIndex={0}
              onClick={() => onSelectDate(cell.date)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectDate(cell.date);
                }
              }}
              className={cn(
                "group relative flex min-h-[110px] cursor-pointer flex-col gap-1 border-b border-r border-ink-200 p-1.5 text-left transition-colors dark:border-white/[0.06]",
                "hover:bg-ink-50 dark:hover:bg-white/[0.02]",
                !cell.current && "bg-ink-50/40 dark:bg-white/[0.01]",
                isSelected && "bg-brand-500/5"
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                    !cell.current && "text-ink-400",
                    cell.current && !isToday && "text-ink-700",
                    isToday && "bg-brand-500 text-white"
                  )}
                >
                  {cell.day}
                </span>
                {events.length > 3 && (
                  <span className="text-[10px] font-medium text-ink-400">
                    +{events.length - 3}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-0.5">
                {events.slice(0, 3).map((e: CalendarEvent) => (
                  <EventChip key={e.id} event={e} variant="compact" onPreview={onPreview} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}