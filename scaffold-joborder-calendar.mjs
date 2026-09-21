#!/usr/bin/env node
/**
 * Job Order Calendar — month view + list toggle + filters
 * Usage: node scaffold-joborder-calendar.mjs
 *
 * Creates:
 *   src/lib/maintenance/calendar-types.ts
 *   src/lib/maintenance/calendar-aggregate.ts
 *   src/components/maintenance/calendar/job-calendar-shell.tsx
 *   src/components/maintenance/calendar/job-month-grid.tsx
 *   src/components/maintenance/calendar/job-list-view.tsx
 *   src/components/maintenance/calendar/job-day-panel.tsx
 *   src/components/maintenance/calendar/job-event-chip.tsx
 *   src/components/maintenance/calendar/job-calendar-filters.tsx
 *   src/components/maintenance/calendar/job-legend.tsx
 *   src/app/(dashboard)/maintenance/calendar/page.tsx
 *   src/app/api/maintenance/calendar/month/route.ts
 *
 * Updates:
 *   src/components/shell/sidebar.tsx  (add Calendar link under Maintenance)
 */

import { mkdir, writeFile, access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { join, dirname } from "node:path";

const ROOT = process.cwd();
const FILES = {};

async function exists(p) {
  try { await access(p, constants.F_OK); return true; } catch { return false; }
}

// =============================================================================
// 1. Types
// =============================================================================
FILES["src/lib/maintenance/calendar-types.ts"] =
`export type JobEventType =
  | "job_open"
  | "job_pending_approval"
  | "job_assigned"
  | "job_in_progress"
  | "job_done"
  | "job_cancelled";

export type JobCalendarEvent = {
  id: string;
  date: string; // YYYY-MM-DD
  type: JobEventType;
  title: string;
  subtitle?: string;
  priority: "low" | "normal" | "high" | "urgent";
  status: string;
  cost?: number;
  href?: string;
  unit_number?: string;
  property_name?: string;
  task_type_name?: string;
  meta?: Record<string, string | number | undefined>;
};

export type JobCalendarMonth = {
  year: number;
  month: number;
  eventsByDate: Record<string, JobCalendarEvent[]>;
};

export type JobCalendarFilters = {
  property_id?: string | null;
  statuses: string[];
  priorities: string[];
};

export const JOB_EVENT_LABELS: Record<JobEventType, string> = {
  job_open: "Open",
  job_pending_approval: "Pending approval",
  job_assigned: "Assigned",
  job_in_progress: "In progress",
  job_done: "Completed",
  job_cancelled: "Cancelled",
};

export const JOB_EVENT_COLORS: Record<
  JobEventType,
  { dot: string; bg: string; text: string; border: string }
> = {
  job_open: {
    dot: "bg-ink-500",
    bg: "bg-ink-500/10",
    text: "text-ink-700 dark:text-ink-500",
    border: "border-ink-500/30",
  },
  job_pending_approval: {
    dot: "bg-warning-500",
    bg: "bg-warning-500/10",
    text: "text-warning-700 dark:text-warning-500",
    border: "border-warning-500/30",
  },
  job_assigned: {
    dot: "bg-brand-500",
    bg: "bg-brand-500/10",
    text: "text-brand-700 dark:text-brand-400",
    border: "border-brand-500/30",
  },
  job_in_progress: {
    dot: "bg-purple-500",
    bg: "bg-purple-500/10",
    text: "text-purple-700 dark:text-purple-400",
    border: "border-purple-500/30",
  },
  job_done: {
    dot: "bg-success-500",
    bg: "bg-success-500/10",
    text: "text-success-700 dark:text-success-500",
    border: "border-success-500/30",
  },
  job_cancelled: {
    dot: "bg-danger-500",
    bg: "bg-danger-500/10",
    text: "text-danger-700 dark:text-danger-500",
    border: "border-danger-500/30",
  },
};

export const PRIORITY_LABELS: Record<string, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

export const STATUS_TO_EVENT: Record<string, JobEventType> = {
  open: "job_open",
  pending_approval: "job_pending_approval",
  assigned: "job_assigned",
  in_progress: "job_in_progress",
  done: "job_done",
  cancelled: "job_cancelled",
};

export const ALL_JOB_STATUSES = [
  "open",
  "pending_approval",
  "assigned",
  "in_progress",
  "done",
  "cancelled",
];

export const ALL_JOB_PRIORITIES = ["low", "normal", "high", "urgent"];
`;

// =============================================================================
// 2. Aggregate
// =============================================================================
FILES["src/lib/maintenance/calendar-aggregate.ts"] =
`import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  STATUS_TO_EVENT,
  type JobCalendarEvent,
  type JobCalendarFilters,
  type JobCalendarMonth,
} from "./calendar-types";

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

export async function getJobCalendarMonth(
  year: number,
  month: number,
  filters: JobCalendarFilters = { statuses: [], priorities: [] }
): Promise<JobCalendarMonth> {
  const supabase = await createClient();

  const startStr = ymd(firstDayOfMonth(year, month));
  const endStr = ymd(lastDayOfMonth(year, month));

  // Load all job orders with created_at in the window
  const { data: jobs } = await supabase
    .from("job_order")
    .select(
      "id, unit_id, task_type_id, priority, status, description, cost_estimate, created_at, closed_at, requested_by_user_id"
    )
    .gte("created_at", startStr + "T00:00:00.000Z")
    .lte("created_at", endStr + "T23:59:59.999Z")
    .order("created_at", { ascending: true });

  const jobRows = (jobs ?? []) as any[];
  const unitIds = Array.from(new Set(jobRows.map((j) => j.unit_id))).filter(Boolean);
  const taskTypeIds = Array.from(new Set(jobRows.map((j) => j.task_type_id))).filter(Boolean);

  // Unit + property info
  const unitLookup = new Map<
    string,
    { unit_number: string; property_id: string; property_name: string }
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
        property_name: propMap.get(u.property_id) ?? "",
      });
    }
  }

  // Task type names
  const taskMap = new Map<string, string>();
  if (taskTypeIds.length > 0) {
    const { data: types } = await supabase
      .from("job_task_type")
      .select("id, name")
      .in("id", taskTypeIds);
    for (const t of types ?? []) taskMap.set(t.id, t.name);
  }

  // Build events keyed by created_at date
  const eventsByDate: Record<string, JobCalendarEvent[]> = {};

  function push(date: string, evt: JobCalendarEvent) {
    if (!eventsByDate[date]) eventsByDate[date] = [];
    eventsByDate[date].push(evt);
  }

  for (const j of jobRows) {
    const info = unitLookup.get(j.unit_id);
    if (filters.property_id && info?.property_id !== filters.property_id) continue;
    if (filters.statuses.length > 0 && !filters.statuses.includes(j.status)) continue;
    if (filters.priorities.length > 0 && !filters.priorities.includes(j.priority)) continue;

    const eventType = STATUS_TO_EVENT[j.status] ?? "job_open";
    const date = j.created_at.slice(0, 10);

    push(date, {
      id: "job_" + j.id,
      date,
      type: eventType,
      title: (taskMap.get(j.task_type_id) ?? "Job order") + " — " + (info?.unit_number ?? "Unit ?"),
      subtitle: (info?.property_name ? info.property_name : "") +
        (j.description ? " · " + j.description.slice(0, 60) : ""),
      priority: j.priority,
      status: j.status,
      cost: j.cost_estimate != null ? Number(j.cost_estimate) : undefined,
      href: "/maintenance/job-orders/" + j.id,
      unit_number: info?.unit_number,
      property_name: info?.property_name,
      task_type_name: taskMap.get(j.task_type_id),
    });

    // Also add a "closed" event on the closed_at date if the status is done/cancelled
    if ((j.status === "done" || j.status === "cancelled") && j.closed_at) {
      const closedDate = j.closed_at.slice(0, 10);
      if (closedDate >= startStr && closedDate <= endStr) {
        push(closedDate, {
          id: "job_closed_" + j.id,
          date: closedDate,
          type: STATUS_TO_EVENT[j.status] ?? "job_done",
          title: "Closed: " + (taskMap.get(j.task_type_id) ?? "Job order") + " — " + (info?.unit_number ?? ""),
          subtitle: info?.property_name ?? "",
          priority: j.priority,
          status: j.status,
          cost: j.cost_estimate != null ? Number(j.cost_estimate) : undefined,
          href: "/maintenance/job-orders/" + j.id,
          unit_number: info?.unit_number,
          property_name: info?.property_name,
          task_type_name: taskMap.get(j.task_type_id),
          meta: { is_close_event: "1" },
        });
      }
    }
  }

  // Sort each day: urgent first, then by status order
  const statusOrder = ["urgent", "high", "normal", "low"];
  for (const date of Object.keys(eventsByDate)) {
    eventsByDate[date].sort((a, b) => {
      const pa = statusOrder.indexOf(a.priority);
      const pb = statusOrder.indexOf(b.priority);
      if (pa !== pb) return pa - pb;
      return a.status.localeCompare(b.status);
    });
  }

  return { year, month, eventsByDate };
}

export function summarizeJobMonth(month: JobCalendarMonth) {
  const counts: Record<string, number> = {};
  let totalCost = 0;
  let urgentCount = 0;

  for (const date of Object.keys(month.eventsByDate)) {
    for (const e of month.eventsByDate[date]) {
      counts[e.type] = (counts[e.type] ?? 0) + 1;
      if (e.cost) totalCost += e.cost;
      if (e.priority === "urgent" && e.status !== "done" && e.status !== "cancelled") urgentCount++;
    }
  }

  return { counts, totalCost, urgentCount };
}
`;

// =============================================================================
// 3. Event chip
// =============================================================================
FILES["src/components/maintenance/calendar/job-event-chip.tsx"] =
`"use client";

import { cn } from "@/lib/utils/cn";
import { formatPHP } from "@/lib/utils/format-php";
import { JOB_EVENT_COLORS, type JobCalendarEvent } from "@/lib/maintenance/calendar-types";

export function JobEventChip({
  event,
  variant = "compact",
  onPreview,
}: {
  event: JobCalendarEvent;
  variant?: "compact" | "full";
  onPreview?: (e: JobCalendarEvent) => void;
}) {
  const colors = JOB_EVENT_COLORS[event.type];
  const isUrgent = event.priority === "urgent" && event.status !== "done" && event.status !== "cancelled";

  function handleClick(e: React.MouseEvent) {
    if (onPreview) {
      e.preventDefault();
      e.stopPropagation();
      onPreview(event);
    }
  }

  if (variant === "compact") {
    return (
      <button
        onClick={handleClick}
        className={cn(
          "group flex w-full items-center gap-1.5 truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium transition-all",
          colors.bg,
          colors.text,
          isUrgent && "ring-1 ring-danger-500/60 animate-pulse-slow"
        )}
        title={event.title}
      >
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", colors.dot)} />
        <span className="truncate">{event.title}</span>
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      className={cn(
        "flex w-full items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors hover:bg-ink-50 dark:hover:bg-white/[0.03]",
        colors.border,
        isUrgent && "ring-1 ring-danger-500/60"
      )}
    >
      <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", colors.dot)} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink-900">{event.title}</p>
        {event.subtitle && (
          <p className="truncate text-xs text-ink-500">{event.subtitle}</p>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {event.task_type_name && (
            <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-medium text-ink-600 dark:bg-white/[0.06]">
              {event.task_type_name}
            </span>
          )}
          <span className={cn(
            "rounded px-1.5 py-0.5 text-[10px] font-semibold capitalize",
            event.priority === "urgent" && "bg-danger-500/15 text-danger-700 dark:text-danger-500",
            event.priority === "high" && "bg-warning-500/15 text-warning-700 dark:text-warning-500",
            (event.priority === "normal" || event.priority === "low") && "bg-ink-100 text-ink-600 dark:bg-white/[0.06]"
          )}>
            {event.priority}
          </span>
        </div>
        {event.cost != null && (
          <p className="mt-1 text-xs font-semibold text-ink-700 dark:text-ink-600">
            {formatPHP(event.cost)}
          </p>
        )}
      </div>
    </button>
  );
}
`;

// =============================================================================
// 4. Legend
// =============================================================================
FILES["src/components/maintenance/calendar/job-legend.tsx"] =
`import { cn } from "@/lib/utils/cn";
import { JOB_EVENT_COLORS, JOB_EVENT_LABELS } from "@/lib/maintenance/calendar-types";

const ORDER: (keyof typeof JOB_EVENT_COLORS)[] = [
  "job_open",
  "job_pending_approval",
  "job_assigned",
  "job_in_progress",
  "job_done",
  "job_cancelled",
];

export function JobLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      {ORDER.map((t) => (
        <div key={t} className="flex items-center gap-2 text-xs text-ink-600">
          <span className={cn("h-2 w-2 rounded-full", JOB_EVENT_COLORS[t].dot)} />
          {JOB_EVENT_LABELS[t]}
        </div>
      ))}
    </div>
  );
}
`;

// =============================================================================
// 5. Filters
// =============================================================================
FILES["src/components/maintenance/calendar/job-calendar-filters.tsx"] =
`"use client";

import { Filter, X } from "lucide-react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import {
  ALL_JOB_PRIORITIES,
  ALL_JOB_STATUSES,
  PRIORITY_LABELS,
  STATUS_TO_EVENT,
  JOB_EVENT_LABELS,
} from "@/lib/maintenance/calendar-types";

export function JobCalendarFilters({
  properties,
}: {
  properties: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const property = searchParams.get("property") ?? "";
  const statusesParam = searchParams.get("statuses") ?? "";
  const prioritiesParam = searchParams.get("priorities") ?? "";

  const selectedStatuses = statusesParam ? statusesParam.split(",") : [];
  const selectedPriorities = prioritiesParam ? prioritiesParam.split(",") : [];

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.replace(pathname + "?" + params.toString(), { scroll: false });
  }

  function toggleMulti(key: string, list: string[], value: string) {
    const set = new Set(list);
    if (set.has(value)) set.delete(value);
    else set.add(value);
    const arr = Array.from(set);
    updateParam(key, arr.length > 0 ? arr.join(",") : null);
  }

  function clearAll() {
    router.replace(pathname, { scroll: false });
  }

  const hasFilters = !!(property || statusesParam || prioritiesParam);

  return (
    <div className="space-y-3 rounded-xl border border-ink-200 bg-surface p-4 dark:border-white/[0.06]">
      <div className="flex items-center gap-2 text-xs font-medium text-ink-500">
        <Filter className="h-3.5 w-3.5" />
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

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {/* Property */}
        <select
          value={property}
          onChange={(e) => updateParam("property", e.target.value || null)}
          className="h-9 rounded-md border border-ink-200 bg-surface px-3 text-sm text-ink-800 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-white/[0.06]"
        >
          <option value="">All properties</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        {/* Priorities */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-ink-500">Priority:</span>
          {ALL_JOB_PRIORITIES.map((p) => (
            <button
              key={p}
              onClick={() => toggleMulti("priorities", selectedPriorities, p)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                selectedPriorities.includes(p)
                  ? p === "urgent"
                    ? "bg-danger-500 text-white"
                    : p === "high"
                    ? "bg-warning-500 text-white"
                    : "bg-brand-500 text-white"
                  : "text-ink-600 hover:bg-ink-100 dark:hover:bg-white/[0.05]"
              )}
            >
              {PRIORITY_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-ink-500">Status:</span>
        {ALL_JOB_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => toggleMulti("statuses", selectedStatuses, s)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              selectedStatuses.includes(s)
                ? "bg-brand-500 text-white"
                : "text-ink-600 hover:bg-ink-100 dark:hover:bg-white/[0.05]"
            )}
          >
            {JOB_EVENT_LABELS[STATUS_TO_EVENT[s]] ?? s}
          </button>
        ))}
      </div>
    </div>
  );
}
`;

// =============================================================================
// 6. Day panel
// =============================================================================
FILES["src/components/maintenance/calendar/job-day-panel.tsx"] =
`"use client";

import { X, CalendarDays } from "lucide-react";
import { JobEventChip } from "./job-event-chip";
import type { JobCalendarEvent } from "@/lib/maintenance/calendar-types";

function formatDay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function JobDayPanel({
  date,
  events,
  onClose,
  onPreview,
}: {
  date: string | null;
  events: JobCalendarEvent[];
  onClose: () => void;
  onPreview: (e: JobCalendarEvent) => void;
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
            <p className="text-sm font-semibold text-ink-900">{formatDay(date)}</p>
            <p className="text-xs text-ink-500">
              {events.length === 0 ? "No jobs" : events.length + " job" + (events.length === 1 ? "" : "s")}
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
            <p className="text-sm text-ink-500">No job orders</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {events.map((e) => (
              <li key={e.id}>
                <JobEventChip event={e} variant="full" onPreview={onPreview} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
`;

// =============================================================================
// 7. Month grid
// =============================================================================
FILES["src/components/maintenance/calendar/job-month-grid.tsx"] =
`"use client";

import { cn } from "@/lib/utils/cn";
import { JobEventChip } from "./job-event-chip";
import type { JobCalendarEvent, JobCalendarMonth } from "@/lib/maintenance/calendar-types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function ymd(y: number, m: number, d: number) {
  return y + "-" + pad2(m) + "-" + pad2(d);
}

export function JobMonthGrid({
  month,
  selectedDate,
  onSelectDate,
  onPreview,
}: {
  month: JobCalendarMonth;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  onPreview: (e: JobCalendarEvent) => void;
}) {
  const { year, month: m, eventsByDate } = month;
  const startWeekday = new Date(year, m - 1, 1).getDay();
  const daysInMonth = new Date(year, m, 0).getDate();
  const daysInPrevMonth = new Date(year, m - 1, 0).getDate();

  const todayYmd = ymd(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate());

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
          <div key={d} className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-ink-500">
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
                  <span className="text-[10px] font-medium text-ink-400">+{events.length - 3}</span>
                )}
              </div>
              <div className="flex flex-col gap-0.5">
                {events.slice(0, 3).map((e) => (
                  <JobEventChip key={e.id} event={e} variant="compact" onPreview={onPreview} />
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
// 8. List view
// =============================================================================
FILES["src/components/maintenance/calendar/job-list-view.tsx"] =
`import { JobEventChip } from "./job-event-chip";
import { Card, CardBody } from "@/components/ui/card";
import type { JobCalendarMonth } from "@/lib/maintenance/calendar-types";

function formatDay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function JobListView({ month }: { month: JobCalendarMonth }) {
  const dates = Object.keys(month.eventsByDate).sort();

  if (dates.length === 0) {
    return (
      <Card>
        <CardBody className="py-16 text-center text-sm text-ink-500">
          No jobs this month.
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {dates.map((date) => {
        const events = month.eventsByDate[date];
        return (
          <Card key={date}>
            <CardBody className="p-0">
              <div className="border-b border-ink-200 px-5 py-2.5 dark:border-white/[0.06]">
                <p className="text-sm font-semibold text-ink-900">{formatDay(date)}</p>
                <p className="text-xs text-ink-500">
                  {events.length} job{events.length === 1 ? "" : "s"}
                </p>
              </div>
              <ul className="divide-y divide-ink-100 dark:divide-white/[0.04]">
                {events.map((e) => (
                  <li key={e.id}>
                    <JobEventChip event={e} variant="full" />
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}
`;

// =============================================================================
// 9. Calendar shell
// =============================================================================
FILES["src/components/maintenance/calendar/job-calendar-shell.tsx"] =
`"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, List, Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { JobMonthGrid } from "./job-month-grid";
import { JobListView } from "./job-list-view";
import { JobDayPanel } from "./job-day-panel";
import { JobLegend } from "./job-legend";
import { JobCalendarFilters } from "./job-calendar-filters";
import type { JobCalendarEvent, JobCalendarMonth } from "@/lib/maintenance/calendar-types";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function JobCalendarShell({
  initial,
  properties,
}: {
  initial: JobCalendarMonth;
  properties: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [month, setMonth] = useState<JobCalendarMonth>(initial);
  const [view, setView] = useState<"month" | "list">(
    (searchParams.get("view") as "month" | "list") ?? "month"
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const selectedProperty = searchParams.get("property");
  const statusesParam = searchParams.get("statuses") ?? "";
  const prioritiesParam = searchParams.get("priorities") ?? "";

  function updateQuery(next: {
    property?: string | null;
    statuses?: string | null;
    priorities?: string | null;
    view?: "month" | "list";
  }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.property !== undefined) {
      if (next.property) params.set("property", next.property);
      else params.delete("property");
    }
    if (next.statuses !== undefined) {
      if (next.statuses) params.set("statuses", next.statuses);
      else params.delete("statuses");
    }
    if (next.priorities !== undefined) {
      if (next.priorities) params.set("priorities", next.priorities);
      else params.delete("priorities");
    }
    if (next.view !== undefined) params.set("view", next.view);
    router.replace(pathname + "?" + params.toString(), { scroll: false });
  }

  useEffect(() => {
    let cancelled = false;
    setPending(true);

    const params = new URLSearchParams();
    params.set("year", String(month.year));
    params.set("month", String(month.month));
    if (selectedProperty) params.set("property", selectedProperty);
    if (statusesParam) params.set("statuses", statusesParam);
    if (prioritiesParam) params.set("priorities", prioritiesParam);

    fetch("/api/maintenance/calendar/month?" + params.toString(), { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) {
          setMonth(data);
          setSelectedDate(null);
        }
      })
      .finally(() => {
        if (!cancelled) setPending(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProperty, statusesParam, prioritiesParam, month.year, month.month]);

  async function goToMonth(year: number, m: number) {
    setPending(true);
    try {
      const params = new URLSearchParams();
      params.set("year", String(year));
      params.set("month", String(m));
      if (selectedProperty) params.set("property", selectedProperty);
      if (statusesParam) params.set("statuses", statusesParam);
      if (prioritiesParam) params.set("priorities", prioritiesParam);

      const res = await fetch("/api/maintenance/calendar/month?" + params.toString(), { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as JobCalendarMonth;
        setMonth(data);
        setSelectedDate(null);
      }
    } finally {
      setPending(false);
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
  }

  const selectedEvents = selectedDate ? month.eventsByDate[selectedDate] ?? [] : [];

  return (
    <div className="space-y-4">
      <JobCalendarFilters properties={properties} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="icon" onClick={prevMonth} disabled={pending}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="min-w-[180px] text-lg font-semibold tracking-tight text-ink-900">
            {MONTH_NAMES[month.month - 1]} {month.year}
          </h2>
          <Button variant="secondary" size="icon" onClick={nextMonth} disabled={pending}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" onClick={today} disabled={pending}>
            Today
          </Button>
        </div>

        <div className="flex rounded-lg border border-ink-200 p-0.5 dark:border-white/[0.06]">
          <button
            onClick={() => { setView("month"); updateQuery({ view: "month" }); }}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              view === "month" ? "bg-brand-500 text-white" : "text-ink-600 hover:bg-ink-100 dark:hover:bg-white/[0.05]"
            )}
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            Month
          </button>
          <button
            onClick={() => { setView("list"); updateQuery({ view: "list" }); }}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              view === "list" ? "bg-brand-500 text-white" : "text-ink-600 hover:bg-ink-100 dark:hover:bg-white/[0.05]"
            )}
          >
            <List className="h-3.5 w-3.5" />
            List
          </button>
        </div>
      </div>

      <JobLegend />

      {view === "month" ? (
        <JobMonthGrid
          month={month}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onPreview={(e) => {
            if (e.href) window.location.href = e.href;
          }}
        />
      ) : (
        <JobListView month={month} />
      )}

      <JobDayPanel
        date={selectedDate}
        events={selectedEvents}
        onClose={() => setSelectedDate(null)}
        onPreview={(e) => {
          if (e.href) window.location.href = e.href;
        }}
      />
    </div>
  );
}
`;

// =============================================================================
// 10. API route
// =============================================================================
FILES["src/app/api/maintenance/calendar/month/route.ts"] =
`import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { hasPermission } from "@/lib/auth/require-permission";
import { getJobCalendarMonth } from "@/lib/maintenance/calendar-aggregate";
import { ALL_JOB_PRIORITIES, ALL_JOB_STATUSES } from "@/lib/maintenance/calendar-types";

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ok = await hasPermission("joborder:read");
  if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const year = Number(url.searchParams.get("year"));
  const month = Number(url.searchParams.get("month"));
  const propertyId = url.searchParams.get("property");
  const statusesParam = url.searchParams.get("statuses") ?? "";
  const prioritiesParam = url.searchParams.get("priorities") ?? "";

  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Invalid year or month" }, { status: 400 });
  }

  const statuses = statusesParam
    ? statusesParam.split(",").filter((s) => ALL_JOB_STATUSES.includes(s))
    : [];
  const priorities = prioritiesParam
    ? prioritiesParam.split(",").filter((p) => ALL_JOB_PRIORITIES.includes(p))
    : [];

  try {
    const data = await getJobCalendarMonth(year, month, {
      property_id: propertyId || null,
      statuses,
      priorities,
    });
    return NextResponse.json(data);
  } catch (err) {
    console.error("[api/maintenance/calendar/month]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
`;

// =============================================================================
// 11. Page
// =============================================================================
FILES["src/app/(dashboard)/maintenance/calendar/page.tsx"] =
`import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { getJobCalendarMonth, summarizeJobMonth } from "@/lib/maintenance/calendar-aggregate";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { JobCalendarShell } from "@/components/maintenance/calendar/job-calendar-shell";
import { formatPHP } from "@/lib/utils/format-php";

export default async function MaintenanceCalendarPage() {
  await requirePagePermission("joborder:read");
  const supabase = await createClient();

  const now = new Date();

  const [month, properties] = await Promise.all([
    getJobCalendarMonth(now.getFullYear(), now.getMonth() + 1, { statuses: [], priorities: [] }),
    supabase.from("property").select("id, name").is("archived_at", null).order("name"),
  ]);

  const summary = summarizeJobMonth(month);
  const total = Object.values(summary.counts).reduce((s, n) => s + n, 0);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/maintenance"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-ink-500 transition-colors hover:text-ink-800"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to job orders
        </Link>
        <PageHeader
          title="Maintenance calendar"
          description="Job orders by date — open, pending approval, and completed."
        />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total jobs this month" value={total} accent="brand" />
        <StatCard label="Urgent" value={summary.urgentCount} accent="red" />
        <StatCard label="Pending approval" value={summary.counts.job_pending_approval ?? 0} accent="yellow" />
        <StatCard label="Total cost" value={formatPHP(summary.totalCost)} accent="purple" />
      </div>

      <JobCalendarShell initial={month} properties={properties.data ?? []} />
    </div>
  );
}
`;

// =============================================================================
// 12. Sidebar update — add Calendar link under Maintenance
// =============================================================================
FILES["src/components/shell/sidebar.tsx"] =
`"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  DoorOpen,
  Users,
  FileText,
  ScrollText,
  FileSignature,
  Wrench,
  Package,
  Settings2,
  Megaphone,
  ListChecks,
  MessageSquare,
  Receipt,
  CreditCard,
  Wallet,
  CheckSquare,
  BarChart3,
  ShieldCheck,
  Calendar as CalendarIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { UserRole } from "@/lib/auth/get-user-roles";
import { UserMenu } from "./user-menu";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: string[];
  exact?: boolean;
};

type NavGroup = { label: string; roles: string[]; items: NavItem[] };

const GROUPS: NavGroup[] = [
  {
    label: "Overview",
    roles: ["*"],
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["*"], exact: true },
    ],
  },
  {
    label: "Property",
    roles: ["property_rep", "executive", "marketing", "maintenance"],
    items: [
      { href: "/property/properties", label: "Properties", icon: Building2, roles: ["property_rep", "executive"] },
      { href: "/property/units",      label: "Units",      icon: DoorOpen, roles: ["property_rep", "executive", "marketing", "maintenance"] },
      { href: "/property/tenants",    label: "Tenants",    icon: Users, roles: ["property_rep", "executive"] },
      { href: "/property/leases",     label: "Leases",     icon: FileText, roles: ["property_rep", "executive"] },
      { href: "/property/calendar",   label: "Calendar",   icon: CalendarIcon, roles: ["property_rep", "executive"] },
      { href: "/property/contracts",  label: "Contracts",  icon: FileSignature, roles: ["property_rep", "executive"] },
      { href: "/property/templates",  label: "Templates",  icon: ScrollText, roles: ["property_rep", "executive"] },
    ],
  },
  {
    label: "Marketing",
    roles: ["marketing", "executive"],
    items: [
      { href: "/marketing",           label: "Overview",  icon: BarChart3, roles: ["marketing", "executive"], exact: true },
      { href: "/marketing/listings",  label: "Listings",  icon: Megaphone, roles: ["marketing", "executive"] },
      { href: "/marketing/forecast",  label: "Forecast",  icon: ListChecks, roles: ["marketing", "executive", "property_rep"] },
      { href: "/marketing/inquiries", label: "Inquiries", icon: MessageSquare, roles: ["marketing", "executive"] },
    ],
  },
  {
    label: "Accounting",
    roles: ["accounting", "executive"],
    items: [
      { href: "/accounting",           label: "Overview",  icon: BarChart3, roles: ["accounting", "executive"], exact: true },
      { href: "/accounting/calendar",  label: "Calendar",  icon: CalendarIcon, roles: ["accounting", "executive"] },
      { href: "/accounting/invoices",  label: "Invoices",  icon: Receipt, roles: ["accounting", "executive"] },
      { href: "/accounting/payments",  label: "Payments",  icon: CreditCard, roles: ["accounting", "executive"] },
      { href: "/accounting/deposits",  label: "Deposits",  icon: Wallet, roles: ["accounting", "executive"] },
      { href: "/accounting/approvals", label: "Approvals", icon: CheckSquare, roles: ["accounting", "executive"] },
    ],
  },
  {
    label: "Maintenance",
    roles: ["maintenance", "executive", "property_rep"],
    items: [
      { href: "/maintenance",            label: "Job Orders", icon: Wrench, roles: ["maintenance", "executive", "property_rep"], exact: true },
      { href: "/maintenance/calendar",   label: "Calendar",   icon: CalendarIcon, roles: ["maintenance", "executive", "property_rep"] },
      { href: "/maintenance/assets",     label: "Assets",     icon: Package, roles: ["maintenance", "executive"] },
      { href: "/maintenance/task-types", label: "Task Types", icon: Settings2, roles: ["executive"] },
    ],
  },
  {
    label: "Admin",
    roles: ["executive", "system_admin"],
    items: [
      { href: "/executive", label: "Executive",    icon: BarChart3, roles: ["executive"] },
      { href: "/admin",     label: "System Admin", icon: ShieldCheck, roles: ["system_admin"] },
    ],
  },
];

export function Sidebar({
  roles,
  email,
}: {
  roles: UserRole[];
  email: string;
}) {
  const pathname = usePathname();
  const keys = roles.map((r) => r.role_key);

  const visibleGroups: NavGroup[] = GROUPS.map((g) => {
    if (!g.roles.includes("*") && !g.roles.some((r) => keys.includes(r))) return null;
    const items = g.items.filter(
      (item) => item.roles.includes("*") || item.roles.some((r) => keys.includes(r))
    );
    if (items.length === 0) return null;
    return { ...g, items };
  }).filter((g): g is NavGroup => g !== null);

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-ink-200/60 px-5 dark:border-white/[0.06]">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-gradient shadow-glow-sm">
          <span className="text-sm font-bold text-white">A</span>
        </div>
        <span className="text-[15px] font-semibold tracking-tight text-ink-900">
          Apartment Portal
        </span>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {visibleGroups.map((g) => (
          <div key={g.label}>
            <p className="mb-2 px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-400">
              {g.label}
            </p>
            <ul className="space-y-0.5">
              {g.items.map((item) => {
                const active = item.exact
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-all",
                        active
                          ? "bg-brand-500/10 font-medium text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"
                          : "text-ink-600 hover:bg-ink-100 hover:text-ink-900 dark:hover:bg-white/[0.04] dark:hover:text-ink-900"
                      )}
                    >
                      {active && (
                        <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-500" />
                      )}
                      <Icon
                        className={cn(
                          "h-[18px] w-[18px] shrink-0 transition-colors",
                          active
                            ? "text-brand-500 dark:text-brand-400"
                            : "text-ink-400 group-hover:text-ink-600"
                        )}
                      />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-ink-200/60 p-3 dark:border-white/[0.06]">
        <UserMenu email={email} roles={roles} />
      </div>
    </div>
  );
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

  console.log("Job Order Calendar\\n");

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
  console.log("  Visit http://localhost:3000/maintenance/calendar");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});