#!/usr/bin/env node
/**
 * Calendar Phase 5 — Week view, drag-to-reschedule, month report
 * Usage: node scaffold-calendar-pass5.mjs
 *
 * Creates:
 *   src/components/calendar/week-view.tsx
 *   src/components/calendar/draggable-chip.tsx
 *   src/components/calendar/month-report.tsx
 *   src/app/(dashboard)/accounting/calendar/report/page.tsx
 *   src/app/api/calendar/report/route.ts
 *
 * Updates:
 *   src/app/(dashboard)/accounting/calendar/actions.ts  (add reschedule + bulk notify)
 *   src/components/calendar/calendar-shell.tsx          (3rd view, drag context)
 *   src/components/calendar/event-preview.tsx           (action buttons)
 *   src/components/calendar/month-grid.tsx              (drag targets)
 *   src/lib/calendar/types.ts                           (ViewMode type)
 */

import { mkdir, writeFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import { join, dirname } from "node:path";

const ROOT = process.cwd();
const FILES = {};

async function exists(p) {
  try { await access(p, constants.F_OK); return true; } catch { return false; }
}

// =============================================================================
// 1. types.ts — add ViewMode
// =============================================================================
FILES["src/lib/calendar/types.ts"] =
`export type CalendarEventType =
  | "rent_due"
  | "invoice_due"
  | "lease_starting"
  | "lease_ending"
  | "payment";

export type ViewMode = "month" | "week" | "list";

export type CalendarEvent = {
  id: string;
  date: string;
  type: CalendarEventType;
  title: string;
  subtitle?: string;
  amount?: number;
  status?: string;
  href?: string;
  property_id?: string;
  property_name?: string;
  /** Source record id — the lease id for lease events, invoice id for invoices, etc. */
  source_id?: string;
  meta?: Record<string, string | number | undefined>;
};

export type CalendarMonth = {
  year: number;
  month: number;
  eventsByDate: Record<string, CalendarEvent[]>;
};

export type CalendarFilters = {
  property_id?: string | null;
  types: CalendarEventType[];
};

export const ALL_TYPES: CalendarEventType[] = [
  "rent_due",
  "invoice_due",
  "lease_starting",
  "lease_ending",
  "payment",
];

export const TYPE_LABELS: Record<CalendarEventType, string> = {
  rent_due: "Rent due",
  invoice_due: "Invoice due",
  lease_starting: "Lease starts",
  lease_ending: "Lease ends",
  payment: "Payment received",
};

export const TYPE_COLORS: Record<
  CalendarEventType,
  { dot: string; bg: string; text: string; border: string }
> = {
  rent_due: {
    dot: "bg-brand-500",
    bg: "bg-brand-500/10",
    text: "text-brand-700 dark:text-brand-400",
    border: "border-brand-500/30",
  },
  invoice_due: {
    dot: "bg-warning-500",
    bg: "bg-warning-500/10",
    text: "text-warning-700 dark:text-warning-500",
    border: "border-warning-500/30",
  },
  lease_starting: {
    dot: "bg-success-500",
    bg: "bg-success-500/10",
    text: "text-success-700 dark:text-success-500",
    border: "border-success-500/30",
  },
  lease_ending: {
    dot: "bg-danger-500",
    bg: "bg-danger-500/10",
    text: "text-danger-700 dark:text-danger-500",
    border: "border-danger-500/30",
  },
  payment: {
    dot: "bg-success-500",
    bg: "bg-success-500/10",
    text: "text-success-700 dark:text-success-500",
    border: "border-success-500/30",
  },
};
`;

// =============================================================================
// 2. Server actions — reschedule + bulk notify
// =============================================================================
FILES["src/app/(dashboard)/accounting/calendar/actions.ts"] =
`"use server";

import { revalidatePath } from "next/cache";
import { assertPermission } from "@/lib/auth/guard";
import { getSession } from "@/lib/auth/get-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCalendarMonth } from "@/lib/calendar/aggregate";
import { logAudit } from "@/lib/audit/log";
import { emit } from "@/lib/events/emit";
import type { CalendarFilters, CalendarMonth } from "@/lib/calendar/types";
import type { ActionResult } from "@/lib/actions/result";

export async function loadCalendarMonthAction(input: {
  year: number;
  month: number;
  filters?: CalendarFilters;
}): Promise<ActionResult<CalendarMonth>> {
  await assertPermission("invoice:read");
  try {
    const data = await getCalendarMonth(
      input.year,
      input.month,
      input.filters ?? { types: [] }
    );
    return { ok: true, data };
  } catch (err) {
    console.error("[loadCalendarMonth]", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to load calendar",
    };
  }
}

/**
 * Move a lease's start_date or end_date to a new date.
 * Called after drag-to-reschedule in the calendar.
 */
export async function rescheduleLeaseAction(input: {
  lease_id: string;
  field: "start_date" | "end_date";
  new_date: string;
}): Promise<ActionResult<{ updated: true }>> {
  await assertPermission("lease:update");
  const session = await getSession();

  // Sanity check
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(input.new_date)) {
    return { ok: false, error: "Invalid date format" };
  }
  if (input.field !== "start_date" && input.field !== "end_date") {
    return { ok: false, error: "Invalid field" };
  }

  try {
    const admin = createAdminClient();

    // Fetch current lease for validation and audit
    const { data: lease, error: fetchErr } = await admin
      .from("lease")
      .select("id, start_date, end_date")
      .eq("id", input.lease_id)
      .single();

    if (fetchErr || !lease) {
      return { ok: false, error: "Lease not found" };
    }

    // Validate ordering
    if (input.field === "start_date" && input.new_date >= lease.end_date) {
      return {
        ok: false,
        error: "Start date must be before end date",
      };
    }
    if (input.field === "end_date" && input.new_date <= lease.start_date) {
      return {
        ok: false,
        error: "End date must be after start date",
      };
    }

    const { error } = await admin
      .from("lease")
      .update({ [input.field]: input.new_date })
      .eq("id", input.lease_id);

    if (error) throw error;

    await logAudit({
      actor_id: session?.id ?? null,
      entity_type: "lease",
      entity_id: input.lease_id,
      action: "update",
      before: { [input.field]: lease[input.field] },
      after: { [input.field]: input.new_date },
      reason: "rescheduled via calendar",
    });

    await emit(
      "lease.rescheduled",
      {
        lease_id: input.lease_id,
        field: input.field,
        old_date: lease[input.field],
        new_date: input.new_date,
      },
      session?.id ?? null
    );

    revalidatePath("/property/calendar");
    revalidatePath("/accounting/calendar");
    revalidatePath("/property/leases/" + input.lease_id);

    return { ok: true, data: { updated: true } };
  } catch (err) {
    console.error("[rescheduleLease]", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to reschedule",
    };
  }
}
`;

// =============================================================================
// 3. Draggable chip — wrapper that adds HTML5 drag behavior
// =============================================================================
FILES["src/components/calendar/draggable-chip.tsx"] =
`"use client";

import { cn } from "@/lib/utils/cn";
import { formatPHP } from "@/lib/utils/format-php";
import { TYPE_COLORS, type CalendarEvent } from "@/lib/calendar/types";

/**
 * Which event types are draggable. Only lease events have a single
 * source date that can be meaningfully moved.
 */
function isDraggable(evt: CalendarEvent): boolean {
  return (
    (evt.type === "lease_starting" || evt.type === "lease_ending") &&
    !!evt.source_id
  );
}

export function DraggableChip({
  event,
  onPreview,
  onDragStart,
  onDragEnd,
}: {
  event: CalendarEvent;
  onPreview: (e: CalendarEvent) => void;
  onDragStart: (e: CalendarEvent) => void;
  onDragEnd: () => void;
}) {
  const colors = TYPE_COLORS[event.type];
  const isOverdue = event.type === "invoice_due" && event.status === "overdue";
  const draggable = isDraggable(event);

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    onPreview(event);
  }

  return (
    <button
      onClick={handleClick}
      draggable={draggable}
      onDragStart={(e) => {
        if (!draggable) {
          e.preventDefault();
          return;
        }
        e.stopPropagation();
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", event.id);
        onDragStart(event);
      }}
      onDragEnd={(e) => {
        e.stopPropagation();
        onDragEnd();
      }}
      className={cn(
        "group flex w-full items-center gap-1.5 truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium transition-all",
        colors.bg,
        colors.text,
        isOverdue && "ring-1 ring-danger-500/60 animate-pulse-slow",
        draggable && "cursor-grab active:cursor-grabbing hover:ring-1 hover:ring-brand-500/40"
      )}
      title={
        draggable
          ? event.title + " — drag to reschedule"
          : event.title
      }
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", colors.dot)} />
      <span className="truncate">{event.title}</span>
      {event.amount != null && (
        <span className="ml-auto shrink-0 text-[10px] font-semibold">
          {formatPHP(event.amount).replace("₱", "")}
        </span>
      )}
    </button>
  );
}
`;

// =============================================================================
// 4. Update month-grid — add drag targets
// =============================================================================
FILES["src/components/calendar/month-grid.tsx"] =
`"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { DraggableChip } from "./draggable-chip";
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
  onDropEvent,
  dragDisabled,
}: {
  month: CalendarMonth;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  onPreview: (e: CalendarEvent) => void;
  onDropEvent: (event: CalendarEvent, newDate: string) => void;
  dragDisabled?: boolean;
}) {
  const { year, month: m, eventsByDate } = month;
  const firstOfMonth = new Date(year, m - 1, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, m, 0).getDate();
  const daysInPrevMonth = new Date(year, m - 1, 0).getDate();

  const now = new Date();
  const todayYmd = ymd(now.getFullYear(), now.getMonth() + 1, now.getDate());

  const [dragging, setDragging] = useState<CalendarEvent | null>(null);
  const [hoverDate, setHoverDate] = useState<string | null>(null);

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

  function handleDragOver(e: React.DragEvent, date: string) {
    if (!dragging) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setHoverDate(date);
  }

  function handleDragLeave() {
    setHoverDate(null);
  }

  function handleDrop(e: React.DragEvent, date: string) {
    e.preventDefault();
    if (dragging && dragging.date !== date) {
      onDropEvent(dragging, date);
    }
    setDragging(null);
    setHoverDate(null);
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
          const isDropTarget = hoverDate === cell.date && dragging;
          const isValidTarget =
            dragging &&
            (dragging.type === "lease_ending" || dragging.type === "lease_starting");

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
              onDragOver={(e) => !dragDisabled && handleDragOver(e, cell.date)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => !dragDisabled && handleDrop(e, cell.date)}
              className={cn(
                "group relative flex min-h-[110px] cursor-pointer flex-col gap-1 border-b border-r border-ink-200 p-1.5 text-left transition-colors dark:border-white/[0.06]",
                "hover:bg-ink-50 dark:hover:bg-white/[0.02]",
                !cell.current && "bg-ink-50/40 dark:bg-white/[0.01]",
                isSelected && "bg-brand-500/5",
                isDropTarget &&
                  isValidTarget &&
                  "bg-brand-500/10 ring-2 ring-brand-500/40 ring-inset"
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
                  <DraggableChip
                    key={e.id}
                    event={e}
                    onPreview={onPreview}
                    onDragStart={setDragging}
                    onDragEnd={() => {
                      setDragging(null);
                      setHoverDate(null);
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
`;

// =============================================================================
// 5. Week view
// =============================================================================
FILES["src/components/calendar/week-view.tsx"] =
`"use client";

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
`;

// =============================================================================
// 6. Update event preview — add action buttons
// =============================================================================
FILES["src/components/calendar/event-preview.tsx"] =
`"use client";

import Link from "next/link";
import { X, ExternalLink, Calendar, Building2, Receipt, FileText, Send } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { formatPHP } from "@/lib/utils/format-php";
import { TYPE_COLORS, TYPE_LABELS, type CalendarEvent } from "@/lib/calendar/types";

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function EventPreview({
  event,
  onClose,
}: {
  event: CalendarEvent | null;
  onClose: () => void;
}) {
  if (!event) return null;
  const colors = TYPE_COLORS[event.type];

  // Type-specific quick actions
  const actions: { label: string; href: string; icon: React.ReactNode }[] = [];

  if (event.type === "invoice_due" && event.source_id) {
    actions.push({
      label: "Record payment",
      href: "/accounting/invoices/" + event.source_id,
      icon: <Receipt className="h-3.5 w-3.5" />,
    });
  }
  if (
    (event.type === "lease_starting" || event.type === "lease_ending") &&
    event.source_id
  ) {
    actions.push({
      label: "Open lease",
      href: "/property/leases/" + event.source_id,
      icon: <FileText className="h-3.5 w-3.5" />,
    });
  }
  if (event.type === "rent_due" && event.source_id) {
    actions.push({
      label: "Send reminder",
      href: "/property/leases/" + event.source_id,
      icon: <Send className="h-3.5 w-3.5" />,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-ink-200 bg-surface shadow-lg dark:border-white/[0.08]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-ink-200 px-5 py-4 dark:border-white/[0.06]">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                colors.bg
              )}
            >
              <span className={cn("h-2.5 w-2.5 rounded-full", colors.dot)} />
            </div>
            <div className="min-w-0">
              <p className={cn("text-xs font-medium uppercase tracking-wider", colors.text)}>
                {TYPE_LABELS[event.type]}
              </p>
              <p className="mt-0.5 text-base font-semibold text-ink-900">
                {event.title}
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

        <div className="space-y-3 px-5 py-4">
          <Row
            icon={<Calendar className="h-4 w-4" />}
            label="Date"
            value={formatDate(event.date)}
          />
          {event.subtitle && (
            <Row
              icon={<Building2 className="h-4 w-4" />}
              label="Tenant / Unit"
              value={event.subtitle}
            />
          )}
          {event.property_name && (
            <Row
              icon={<Building2 className="h-4 w-4" />}
              label="Property"
              value={event.property_name}
            />
          )}
          {event.amount != null && (
            <Row
              icon={<span className="text-sm font-semibold">₱</span>}
              label="Amount"
              value={formatPHP(event.amount)}
              highlight
            />
          )}
          {event.status && (
            <Row
              icon={<span className="text-sm font-semibold">●</span>}
              label="Status"
              value={event.status}
            />
          )}
        </div>

        {/* Quick actions */}
        {actions.length > 0 && (
          <div className="border-t border-ink-200 px-5 py-3 dark:border-white/[0.06]">
            <p className="mb-2 text-xs font-medium text-ink-500">Quick actions</p>
            <div className="flex flex-wrap gap-2">
              {actions.map((a) => (
                <Link key={a.label} href={a.href}>
                  <Button variant="secondary" size="sm">
                    {a.icon}
                    <span className="ml-1.5">{a.label}</span>
                  </Button>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-ink-200 px-5 py-3 dark:border-white/[0.06]">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          {event.href && (
            <Link href={event.href}>
              <Button>
                Open
                <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center text-ink-400">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-ink-500">{label}</p>
        <p
          className={cn(
            "text-sm capitalize",
            highlight ? "font-semibold text-success-700 dark:text-success-500" : "text-ink-900"
          )}
        >
          {value}
        </p>
      </div>
    </div>
  );
}
`;

// =============================================================================
// 7. Month report component (printable)
// =============================================================================
FILES["src/components/calendar/month-report.tsx"] =
`import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { formatPHP } from "@/lib/utils/format-php";
import {
  TYPE_COLORS,
  TYPE_LABELS,
  type CalendarEvent,
  type CalendarEventType,
  type CalendarMonth,
} from "@/lib/calendar/types";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-PH", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function MonthReport({
  month,
  propertyName,
}: {
  month: CalendarMonth;
  propertyName?: string;
}) {
  const counts: Record<CalendarEventType, number> = {
    rent_due: 0,
    invoice_due: 0,
    lease_starting: 0,
    lease_ending: 0,
    payment: 0,
  };
  let totalDue = 0;
  let totalPaid = 0;
  let overdue = 0;

  const dates = Object.keys(month.eventsByDate).sort();

  for (const date of dates) {
    for (const e of month.eventsByDate[date]) {
      counts[e.type]++;
      if (e.type === "rent_due" || e.type === "invoice_due") totalDue += e.amount ?? 0;
      if (e.type === "payment") totalPaid += e.amount ?? 0;
      if (e.type === "invoice_due" && e.status === "overdue") overdue++;
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900">
          {MONTHS[month.month - 1]} {month.year}
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          {propertyName ? propertyName + " · " : ""}Monthly calendar report
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <SummaryCard label="Total due" value={formatPHP(totalDue)} tone="warning" />
        <SummaryCard label="Total collected" value={formatPHP(totalPaid)} tone="success" />
        <SummaryCard label="Overdue" value={String(overdue)} tone="danger" />
        <SummaryCard
          label="Total events"
          value={String(Object.values(counts).reduce((s, n) => s + n, 0))}
          tone="brand"
        />
      </div>

      {/* Counts by type */}
      <Card>
        <CardHeader title="Events by type" />
        <CardBody>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {(Object.keys(counts) as CalendarEventType[]).map((t) => (
              <div key={t} className="flex items-center gap-2">
                <span className={cn("h-2 w-2 rounded-full", TYPE_COLORS[t].dot)} />
                <div>
                  <p className="text-xs text-ink-500">{TYPE_LABELS[t]}</p>
                  <p className="text-base font-semibold text-ink-900">{counts[t]}</p>
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Full event list */}
      <Card>
        <CardHeader title="All events" description={dates.length + " days with activity"} />
        <CardBody className="p-0">
          {dates.length === 0 ? (
            <p className="py-12 text-center text-sm text-ink-500">
              No events this month.
            </p>
          ) : (
            <ul className="divide-y divide-ink-100 dark:divide-white/[0.04]">
              {dates.map((date) => (
                <li key={date} className="px-5 py-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-500">
                    {formatDate(date)}
                  </p>
                  <ul className="space-y-1.5">
                    {month.eventsByDate[date].map((e) => (
                      <li key={e.id} className="flex items-start gap-2.5 text-sm">
                        <span
                          className={cn(
                            "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                            TYPE_COLORS[e.type].dot
                          )}
                        />
                        <span className="min-w-0 flex-1 text-ink-800">
                          {e.title}
                          {e.subtitle && (
                            <span className="text-ink-500"> · {e.subtitle}</span>
                          )}
                        </span>
                        {e.amount != null && (
                          <span className="shrink-0 font-medium text-ink-900">
                            {formatPHP(e.amount)}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <p className="text-center text-xs text-ink-400">
        Generated {new Date().toLocaleString("en-PH")}
      </p>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "success" | "warning" | "danger" | "brand";
}) {
  const colors = {
    success: "text-success-700 dark:text-success-500",
    warning: "text-warning-700 dark:text-warning-500",
    danger: "text-danger-700 dark:text-danger-500",
    brand: "text-brand-700 dark:text-brand-400",
  };
  return (
    <Card>
      <CardBody>
        <p className="text-xs text-ink-500">{label}</p>
        <p className={cn("mt-1 text-lg font-semibold", colors[tone])}>{value}</p>
      </CardBody>
    </Card>
  );
}

// Small util (inline to avoid import)
function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}
`;

// =============================================================================
// 8. Report page
// =============================================================================
FILES["src/app/(dashboard)/accounting/calendar/report/page.tsx"] =
`import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { getCalendarMonth } from "@/lib/calendar/aggregate";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { MonthReport } from "@/components/calendar/month-report";
import { PrintButton } from "@/components/accounting/print-button";

export default async function CalendarReportPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string; property?: string }>;
}) {
  await requirePagePermission("invoice:read");
  const sp = await searchParams;

  const now = new Date();
  const year = Number(sp.year ?? now.getFullYear());
  const month = Number(sp.month ?? now.getMonth() + 1);
  const propertyId = sp.property ?? null;

  const supabase = await createClient();

  const [data, property] = await Promise.all([
    getCalendarMonth(year, month, {
      property_id: propertyId,
      types: [],
    }),
    propertyId
      ? supabase.from("property").select("name").eq("id", propertyId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return (
    <div className="space-y-6">
      <div className="no-print">
        <Link
          href="/accounting/calendar"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-ink-500 transition-colors hover:text-ink-800"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to calendar
        </Link>
        <PageHeader
          title="Monthly report"
          description="Printable summary of calendar events"
          action={<PrintButton />}
        />
      </div>

      <MonthReport
        month={data}
        propertyName={property.data?.name ?? undefined}
      />
    </div>
  );
}
`;

// =============================================================================
// 9. Update calendar shell — 3 views, drag support, report link
// =============================================================================
FILES["src/components/calendar/calendar-shell.tsx"] =
`"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  List,
  Calendar as CalendarIcon,
  CalendarRange,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { MonthGrid } from "./month-grid";
import { WeekView } from "./week-view";
import { ListView } from "./list-view";
import { DayPanel } from "./day-panel";
import { EventPreview } from "./event-preview";
import { Legend } from "./legend";
import { CalendarFilters } from "./calendar-filters";
import { ExpiringBanner } from "./expiring-banner";
import { ExportMenu } from "./export-menu";
import { rescheduleLeaseAction } from "@/app/(dashboard)/accounting/calendar/actions";
import {
  ALL_TYPES,
  type CalendarEvent,
  type CalendarEventType,
  type CalendarMonth,
  type ViewMode,
} from "@/lib/calendar/types";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function CalendarShell({
  initial,
  properties,
  expiringCount,
  expiringDays,
  expiringHref,
}: {
  initial: CalendarMonth;
  properties: { id: string; name: string }[];
  expiringCount: number;
  expiringDays: number;
  expiringHref: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const toast = useToast();

  const [month, setMonth] = useState<CalendarMonth>(initial);
  const [view, setView] = useState<ViewMode>(
    (searchParams.get("view") as ViewMode) ?? "month"
  );
  const [anchorDate, setAnchorDate] = useState<string>(() => {
    const now = new Date();
    return (
      now.getFullYear() +
      "-" +
      String(now.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(now.getDate()).padStart(2, "0")
    );
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [preview, setPreview] = useState<CalendarEvent | null>(null);
  const [pending, start] = useTransition();

  const selectedProperty = searchParams.get("property");
  const typesParam = searchParams.get("types") ?? "";
  const selectedTypes: CalendarEventType[] = typesParam
    ? (typesParam.split(",").filter((t) => ALL_TYPES.includes(t as CalendarEventType)) as CalendarEventType[])
    : [];

  function updateQuery(next: {
    property?: string | null;
    types?: CalendarEventType[];
    view?: ViewMode;
  }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.property !== undefined) {
      if (next.property) params.set("property", next.property);
      else params.delete("property");
    }
    if (next.types !== undefined) {
      if (next.types.length > 0) params.set("types", next.types.join(","));
      else params.delete("types");
    }
    if (next.view !== undefined) params.set("view", next.view);
    router.replace(pathname + "?" + params.toString(), { scroll: false });
  }

  useEffect(() => {
    let cancelled = false;

    const params = new URLSearchParams();
    params.set("year", String(month.year));
    params.set("month", String(month.month));
    if (selectedProperty) params.set("property", selectedProperty);
    if (selectedTypes.length > 0) params.set("types", selectedTypes.join(","));

    fetch("/api/calendar/month?" + params.toString(), { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) {
          setMonth(data);
          setSelectedDate(null);
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProperty, typesParam, month.year, month.month]);

  async function goToMonth(year: number, m: number) {
    const params = new URLSearchParams();
    params.set("year", String(year));
    params.set("month", String(m));
    if (selectedProperty) params.set("property", selectedProperty);
    if (selectedTypes.length > 0) params.set("types", selectedTypes.join(","));

    const res = await fetch("/api/calendar/month?" + params.toString(), {
      cache: "no-store",
    });
    if (res.ok) {
      const data = (await res.json()) as CalendarMonth;
      setMonth(data);
      setSelectedDate(null);
    }
  }

  function prevMonth() {
    const m = month.month === 1 ? 12 : month.month - 1;
    const y = month.month === 1 ? month.year - 1 : month.year;
    goToMonth(y, m);
  }

  function nextMonth() {
    const m = month.month === 12 ? 1 : month.month + 1;
    const y = month.month === 12 ? month.year + 1 : month.year;
    goToMonth(y, m);
  }

  function today() {
    const now = new Date();
    goToMonth(now.getFullYear(), now.getMonth() + 1);
    setAnchorDate(
      now.getFullYear() +
        "-" +
        String(now.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(now.getDate()).padStart(2, "0")
    );
  }

  function shiftWeek(deltaDays: number) {
    const [y, m, d] = anchorDate.split("-").map(Number);
    const next = new Date(y, m - 1, d);
    next.setDate(next.getDate() + deltaDays);
    setAnchorDate(
      next.getFullYear() +
        "-" +
        String(next.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(next.getDate()).padStart(2, "0")
    );
  }

  function handleDropEvent(event: CalendarEvent, newDate: string) {
    if (!event.source_id) {
      toast.push("This event cannot be rescheduled", "error");
      return;
    }
    if (event.type !== "lease_starting" && event.type !== "lease_ending") {
      toast.push("Only lease events can be rescheduled", "error");
      return;
    }

    const field = event.type === "lease_starting" ? "start_date" : "end_date";

    start(async () => {
      const result = await rescheduleLeaseAction({
        lease_id: event.source_id!,
        field,
        new_date: newDate,
      });
      if (result.ok) {
        toast.push("Lease rescheduled", "success");
        // Refetch current month
        goToMonth(month.year, month.month);
      } else {
        toast.push(result.error, "error");
      }
    });
  }

  const selectedEvents = selectedDate ? month.eventsByDate[selectedDate] ?? [] : [];

  return (
    <div className="space-y-4">
      <ExpiringBanner count={expiringCount} days={expiringDays} href={expiringHref} />

      <CalendarFilters
        properties={properties}
        selectedProperty={selectedProperty}
        onPropertyChange={(id) => updateQuery({ property: id })}
        selectedTypes={selectedTypes}
        onTypesChange={(t) => updateQuery({ types: t })}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {view === "week" ? (
            <>
              <Button variant="secondary" size="icon" onClick={() => shiftWeek(-7)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="min-w-[260px] text-center text-lg font-semibold tracking-tight text-ink-900">
                Week of {new Date(anchorDate).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
              </h2>
              <Button variant="secondary" size="icon" onClick={() => shiftWeek(7)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" size="icon" onClick={prevMonth} disabled={pending}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="min-w-[180px] text-lg font-semibold tracking-tight text-ink-900">
                {MONTH_NAMES[month.month - 1]} {month.year}
              </h2>
              <Button variant="secondary" size="icon" onClick={nextMonth} disabled={pending}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}
          <Button variant="ghost" onClick={today}>
            Today
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {/* View switcher */}
          <div className="flex rounded-lg border border-ink-200 p-0.5 dark:border-white/[0.06]">
            <ViewButton
              active={view === "month"}
              onClick={() => { setView("month"); updateQuery({ view: "month" }); }}
              icon={<CalendarIcon className="h-3.5 w-3.5" />}
              label="Month"
            />
            <ViewButton
              active={view === "week"}
              onClick={() => { setView("week"); updateQuery({ view: "week" }); }}
              icon={<CalendarRange className="h-3.5 w-3.5" />}
              label="Week"
            />
            <ViewButton
              active={view === "list"}
              onClick={() => { setView("list"); updateQuery({ view: "list" }); }}
              icon={<List className="h-3.5 w-3.5" />}
              label="List"
            />
          </div>

          {/* Report link */}
          <Link
            href={
              "/accounting/calendar/report?year=" +
              month.year +
              "&month=" +
              month.month +
              (selectedProperty ? "&property=" + selectedProperty : "")
            }
          >
            <Button variant="secondary">
              <FileText className="mr-1.5 h-3.5 w-3.5" />
              Report
            </Button>
          </Link>

          <ExportMenu year={month.year} month={month.month} />
        </div>
      </div>

      <Legend />

      {view === "month" && (
        <MonthGrid
          month={month}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onPreview={setPreview}
          onDropEvent={handleDropEvent}
        />
      )}

      {view === "week" && (
        <WeekView
          month={month}
          anchorDate={anchorDate}
          onPreview={setPreview}
          onDropEvent={handleDropEvent}
        />
      )}

      {view === "list" && <ListView month={month} />}

      <DayPanel
        date={selectedDate}
        events={selectedEvents}
        onClose={() => setSelectedDate(null)}
        onPreview={setPreview}
      />

      <EventPreview event={preview} onClose={() => setPreview(null)} />
    </div>
  );
}

function ViewButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-brand-500 text-white"
          : "text-ink-600 hover:bg-ink-100 dark:hover:bg-white/[0.05]"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
`;

// =============================================================================
// 10. Update aggregate to include source_id
// =============================================================================
FILES["src/lib/calendar/aggregate.ts"] =
`import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  CalendarEvent,
  CalendarFilters,
  CalendarMonth,
} from "./types";

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + day;
}

function firstDayOfMonth(year: number, month: number): Date {
  return new Date(year, month - 1, 1);
}

function lastDayOfMonth(year: number, month: number): Date {
  return new Date(year, month, 0);
}

function clampDay(year: number, month: number, day: number): string {
  const lastDay = new Date(year, month, 0).getDate();
  const safeDay = Math.min(day, lastDay);
  return year + "-" + String(month).padStart(2, "0") + "-" + String(safeDay).padStart(2, "0");
}

export async function getCalendarMonth(
  year: number,
  month: number,
  filters: CalendarFilters = { types: [] }
): Promise<CalendarMonth> {
  const supabase = await createClient();

  const startDate = firstDayOfMonth(year, month);
  const endDate = lastDayOfMonth(year, month);
  const startStr = ymd(startDate);
  const endStr = ymd(endDate);

  const types = filters.types.length === 0 ? null : new Set(filters.types);
  const shouldInclude = (t: CalendarEvent["type"]) => !types || types.has(t);

  const { data: leaseRows } = await supabase
    .from("lease")
    .select(
      "id, unit_id, tenant_id, start_date, end_date, due_date, monthly_rent, status, unit_number, tenant_name"
    );

  const leases = (leaseRows ?? []) as any[];

  const unitIds = Array.from(new Set(leases.map((l) => l.unit_id))).filter(Boolean);
  const unitLookup = new Map<
    string,
    { unit_number?: string; property_id?: string; property_name?: string }
  >();

  if (unitIds.length > 0) {
    const { data: units } = await supabase
      .from("unit")
      .select("id, unit_number, property_id")
      .in("id", unitIds);

    const propIds = Array.from(new Set((units ?? []).map((u: any) => u.property_id))).filter(Boolean);
    const { data: props } = propIds.length > 0
      ? await supabase.from("property").select("id, name").in("id", propIds)
      : { data: [] as { id: string; name: string }[] };

    const propMap = new Map((props ?? []).map((p: any) => [p.id, p.name]));
    for (const u of units ?? []) {
      unitLookup.set(u.id, {
        unit_number: u.unit_number,
        property_id: u.property_id,
        property_name: propMap.get(u.property_id),
      });
    }
  }

  const filteredLeases = leases.filter((l) => {
    if (!filters.property_id) return true;
    const info = unitLookup.get(l.unit_id);
    return info?.property_id === filters.property_id;
  });

  const { data: invoiceRows } = await supabase
    .from("invoice")
    .select("id, lease_id, type, amount, due_date, status, display_number")
    .gte("due_date", startStr)
    .lte("due_date", endStr);

  const invoices = (invoiceRows ?? []) as any[];

  const leaseIds = Array.from(new Set(invoices.map((i) => i.lease_id))).filter(Boolean);
  const leaseMap = new Map<string, any>();
  for (const l of leases) leaseMap.set(l.id, l);

  const missingLeaseIds = leaseIds.filter((id) => !leaseMap.has(id));
  if (missingLeaseIds.length > 0) {
    const { data: extra } = await supabase
      .from("lease")
      .select(
        "id, unit_id, tenant_id, start_date, end_date, due_date, monthly_rent, status, unit_number, tenant_name"
      )
      .in("id", missingLeaseIds);
    for (const l of extra ?? []) leaseMap.set(l.id, l);
  }

  const startTs = startStr + "T00:00:00.000Z";
  const endTs = endStr + "T23:59:59.999Z";

  const { data: paymentRows } = await supabase
    .from("payment")
    .select("id, invoice_id, amount, method, paid_at, receipt_number")
    .gte("paid_at", startTs)
    .lte("paid_at", endTs);

  const payments = (paymentRows ?? []) as any[];

  const paymentInvoiceIds = Array.from(new Set(payments.map((p) => p.invoice_id))).filter(Boolean);
  let paymentInvoices: any[] = [];
  if (paymentInvoiceIds.length > 0) {
    const { data: inv } = await supabase
      .from("invoice")
      .select("id, lease_id, display_number")
      .in("id", paymentInvoiceIds);
    paymentInvoices = inv ?? [];
  }
  const invoiceMap = new Map<string, any>();
  for (const inv of paymentInvoices) invoiceMap.set(inv.id, inv);

  const eventsByDate: Record<string, CalendarEvent[]> = {};

  function push(date: string, evt: CalendarEvent) {
    if (!eventsByDate[date]) eventsByDate[date] = [];
    eventsByDate[date].push(evt);
  }

  if (shouldInclude("rent_due")) {
    for (const l of filteredLeases) {
      if (!l.due_date) continue;
      if (l.status !== "active" && l.status !== "expiring") continue;
      const dueDay = Number(l.due_date.slice(8, 10));
      if (!dueDay) continue;

      const leaseStart = new Date(l.start_date);
      const leaseEnd = new Date(l.end_date);
      const monthStart = new Date(year, month - 1, 1);
      const monthEnd = new Date(year, month, 0);
      if (monthEnd < leaseStart || monthStart > leaseEnd) continue;

      const day = clampDay(year, month, dueDay);
      const info = unitLookup.get(l.unit_id);
      push(day, {
        id: "rent_" + l.id + "_" + day,
        date: day,
        type: "rent_due",
        title: "Rent due — " + (l.tenant_name ?? "Tenant"),
        subtitle: info?.unit_number ? "Unit " + info.unit_number : undefined,
        amount: Number(l.monthly_rent ?? 0),
        href: "/property/leases/" + l.id,
        source_id: l.id,
        property_id: info?.property_id,
        property_name: info?.property_name,
      });
    }
  }

  if (shouldInclude("invoice_due")) {
    for (const inv of invoices) {
      if (inv.status === "void") continue;
      const l = leaseMap.get(inv.lease_id);
      const info = l ? unitLookup.get(l.unit_id) : undefined;
      if (filters.property_id && info?.property_id !== filters.property_id) continue;

      push(inv.due_date, {
        id: "inv_" + inv.id,
        date: inv.due_date,
        type: "invoice_due",
        title:
          (inv.display_number ?? "Invoice") +
          " — " +
          (inv.type === "rent"
            ? "Rent"
            : inv.type === "deposit"
            ? "Deposit"
            : inv.type === "penalty"
            ? "Penalty"
            : "Other"),
        subtitle: l
          ? (l.tenant_name ?? "") +
            (info?.unit_number ? " · Unit " + info.unit_number : "")
          : undefined,
        amount: Number(inv.amount ?? 0),
        status: inv.status,
        href: "/accounting/invoices/" + inv.id,
        source_id: inv.id,
        property_id: info?.property_id,
        property_name: info?.property_name,
      });
    }
  }

  if (shouldInclude("lease_starting")) {
    for (const l of filteredLeases) {
      if (l.start_date < startStr || l.start_date > endStr) continue;
      const info = unitLookup.get(l.unit_id);
      push(l.start_date, {
        id: "start_" + l.id,
        date: l.start_date,
        type: "lease_starting",
        title: "Lease starts — " + (l.tenant_name ?? "Tenant"),
        subtitle: info?.unit_number ? "Unit " + info.unit_number : undefined,
        amount: Number(l.monthly_rent ?? 0),
        href: "/property/leases/" + l.id,
        source_id: l.id,
        property_id: info?.property_id,
        property_name: info?.property_name,
      });
    }
  }

  if (shouldInclude("lease_ending")) {
    for (const l of filteredLeases) {
      if (l.end_date < startStr || l.end_date > endStr) continue;
      if (l.status !== "active" && l.status !== "expiring") continue;
      const info = unitLookup.get(l.unit_id);
      push(l.end_date, {
        id: "end_" + l.id,
        date: l.end_date,
        type: "lease_ending",
        title: "Lease ends — " + (l.tenant_name ?? "Tenant"),
        subtitle: info?.unit_number ? "Unit " + info.unit_number : undefined,
        href: "/property/leases/" + l.id,
        source_id: l.id,
        property_id: info?.property_id,
        property_name: info?.property_name,
      });
    }
  }

  if (shouldInclude("payment")) {
    for (const p of payments) {
      const inv = invoiceMap.get(p.invoice_id);
      const l = inv ? leaseMap.get(inv.lease_id) : undefined;
      const info = l ? unitLookup.get(l.unit_id) : undefined;
      if (filters.property_id && info?.property_id !== filters.property_id) continue;

      const date = p.paid_at.slice(0, 10);
      push(date, {
        id: "pay_" + p.id,
        date,
        type: "payment",
        title:
          "Payment " +
          (p.receipt_number ?? "") +
          (l?.tenant_name ? " — " + l.tenant_name : ""),
        subtitle: inv?.display_number ? "Invoice " + inv.display_number : undefined,
        amount: Number(p.amount ?? 0),
        href: "/accounting/payments/" + p.id + "/receipt",
        source_id: p.id,
        property_id: info?.property_id,
        property_name: info?.property_name,
      });
    }
  }

  const order: CalendarEvent["type"][] = [
    "rent_due",
    "invoice_due",
    "lease_ending",
    "lease_starting",
    "payment",
  ];
  for (const date of Object.keys(eventsByDate)) {
    eventsByDate[date].sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
  }

  return { year, month, eventsByDate };
}

export function summarizeMonth(month: CalendarMonth) {
  const counts: Record<string, number> = {
    rent_due: 0,
    invoice_due: 0,
    lease_starting: 0,
    lease_ending: 0,
    payment: 0,
  };
  let overdue = 0;
  let totalDue = 0;
  let totalPaid = 0;

  for (const date of Object.keys(month.eventsByDate)) {
    for (const evt of month.eventsByDate[date]) {
      counts[evt.type] = (counts[evt.type] ?? 0) + 1;
      if (evt.type === "invoice_due") {
        if (evt.status === "overdue") overdue++;
        totalDue += evt.amount ?? 0;
      }
      if (evt.type === "rent_due") totalDue += evt.amount ?? 0;
      if (evt.type === "payment") totalPaid += evt.amount ?? 0;
    }
  }

  return { counts, overdue, totalDue, totalPaid };
}

export async function getExpiringSoon(days = 30, property_id?: string | null) {
  const supabase = await createClient();
  const today = new Date();
  const cutoff = new Date(today.getTime() + days * 86400000);

  const todayStr = ymd(today);
  const cutoffStr = ymd(cutoff);

  const { data: leases } = await supabase
    .from("lease")
    .select("id, unit_id, end_date, monthly_rent, tenant_name, status")
    .eq("status", "active")
    .gte("end_date", todayStr)
    .lte("end_date", cutoffStr)
    .order("end_date", { ascending: true });

  const rows = (leases ?? []) as any[];
  if (rows.length === 0) return [];

  const unitIds = Array.from(new Set(rows.map((r) => r.unit_id))).filter(Boolean);
  const { data: units } = unitIds.length > 0
    ? await supabase.from("unit").select("id, unit_number, property_id").in("id", unitIds)
    : { data: [] as any[] };

  const unitMap = new Map((units ?? []).map((u: any) => [u.id, u]));

  let result = rows.map((l) => {
    const u = unitMap.get(l.unit_id) as any;
    const daysLeft = Math.ceil(
      (new Date(l.end_date).getTime() - today.getTime()) / 86400000
    );
    return {
      id: l.id,
      end_date: l.end_date,
      days_left: daysLeft,
      tenant_name: l.tenant_name ?? "—",
      unit_number: u?.unit_number ?? "—",
      property_id: u?.property_id as string | undefined,
    };
  });

  if (property_id) {
    result = result.filter((r) => r.property_id === property_id);
  }

  return result;
}
`;

// -----------------------------------------------------------------------------
// Runner
// -----------------------------------------------------------------------------
async function main() {
  const pkg = join(ROOT, "package.json");
  if (!(await exists(pkg))) {
    console.error("package.json not found. Run from project root.");
    process.exit(1);
  }

  console.log("Calendar Phase 5 — Week view, drag-reschedule, report\\n");

  let count = 0;
  for (const [relPath, content] of Object.entries(FILES)) {
    const full = join(ROOT, relPath);
    const exists_ = await exists(full);
    console.log((exists_ ? "  ~ " : "  + ") + relPath);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, content, "utf8");
    count++;
  }

  console.log("\\nDone — " + count + " file(s) written.\\n");
  console.log("Next:");
  console.log("  npm run typecheck");
  console.log("  npm run dev");
  console.log("\\nTest:");
  console.log("  1. Switch to Week view (toolbar)");
  console.log("  2. Drag a lease-starting or lease-ending chip to a new day");
  console.log("  3. Open /accounting/calendar/report for the printable report");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});