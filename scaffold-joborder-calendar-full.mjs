#!/usr/bin/env node
/**
 * Job Order Calendar — bring to feature parity with accounting calendar
 * Usage: node scaffold-joborder-calendar-full.mjs
 *
 * Creates:
 *   src/components/maintenance/calendar/job-week-view.tsx
 *   src/components/maintenance/calendar/job-export-menu.tsx
 *   src/components/maintenance/calendar/job-event-preview.tsx
 *   src/app/api/maintenance/calendar/export/route.ts
 *
 * Updates:
 *   src/lib/maintenance/calendar-aggregate.ts         (getExpiringJobs + export helper)
 *   src/components/maintenance/calendar/job-calendar-shell.tsx  (3 views, export, preview)
 *   src/app/(dashboard)/maintenance/calendar/page.tsx (stat cards + expiring banner)
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
// 1. Aggregate — add getUpcomingJobs + CSV export
// =============================================================================
FILES["src/lib/maintenance/calendar-aggregate.ts"] =
`import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  JOB_EVENT_LABELS,
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

  const { data: jobs } = await supabase
    .from("job_order")
    .select(
      "id, unit_id, task_type_id, priority, status, description, cost_estimate, created_at, closed_at, scheduled_date, requested_by_user_id"
    )
    .or(
      "and(created_at.gte." + startStr + "T00:00:00.000Z,created_at.lte." + endStr + "T23:59:59.999Z)," +
      "and(scheduled_date.gte." + startStr + ",scheduled_date.lte." + endStr + ")," +
      "and(closed_at.gte." + startStr + "T00:00:00.000Z,closed_at.lte." + endStr + "T23:59:59.999Z)"
    )
    .order("created_at", { ascending: true });

  const jobRows = (jobs ?? []) as any[];
  const unitIds = Array.from(new Set(jobRows.map((j) => j.unit_id))).filter(Boolean);
  const taskTypeIds = Array.from(new Set(jobRows.map((j) => j.task_type_id))).filter(Boolean);

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

  const taskMap = new Map<string, string>();
  if (taskTypeIds.length > 0) {
    const { data: types } = await supabase
      .from("job_task_type")
      .select("id, name")
      .in("id", taskTypeIds);
    for (const t of types ?? []) taskMap.set(t.id, t.name);
  }

  const eventsByDate: Record<string, JobCalendarEvent[]> = {};

  function push(date: string, evt: JobCalendarEvent) {
    if (!eventsByDate[date]) eventsByDate[date] = [];
    eventsByDate[date].push(evt);
  }

  function passFilters(j: any) {
    const info = unitLookup.get(j.unit_id);
    if (filters.property_id && info?.property_id !== filters.property_id) return false;
    if (filters.statuses.length > 0 && !filters.statuses.includes(j.status)) return false;
    if (filters.priorities.length > 0 && !filters.priorities.includes(j.priority)) return false;
    return true;
  }

  for (const j of jobRows) {
    if (!passFilters(j)) continue;
    const info = unitLookup.get(j.unit_id);
    const eventType = STATUS_TO_EVENT[j.status] ?? "job_open";

    const createdDate = j.created_at.slice(0, 10);
    if (createdDate >= startStr && createdDate <= endStr) {
      push(createdDate, {
        id: "job_" + j.id,
        date: createdDate,
        type: eventType,
        title: (taskMap.get(j.task_type_id) ?? "Job order") + " — " + (info?.unit_number ?? "Unit ?"),
        subtitle:
          (info?.property_name ? info.property_name : "") +
          (j.description ? " · " + j.description.slice(0, 60) : ""),
        priority: j.priority,
        status: j.status,
        cost: j.cost_estimate != null ? Number(j.cost_estimate) : undefined,
        href: "/maintenance/job-orders/" + j.id,
        unit_number: info?.unit_number,
        property_name: info?.property_name,
        task_type_name: taskMap.get(j.task_type_id),
        meta: { kind: "created" },
      });
    }

    if (j.scheduled_date && j.scheduled_date >= startStr && j.scheduled_date <= endStr) {
      if (j.scheduled_date !== createdDate) {
        push(j.scheduled_date, {
          id: "job_sched_" + j.id,
          date: j.scheduled_date,
          type: eventType,
          title: "Scheduled: " + (taskMap.get(j.task_type_id) ?? "Job order") + " — " + (info?.unit_number ?? ""),
          subtitle: info?.property_name ?? "",
          priority: j.priority,
          status: j.status,
          cost: j.cost_estimate != null ? Number(j.cost_estimate) : undefined,
          href: "/maintenance/job-orders/" + j.id,
          unit_number: info?.unit_number,
          property_name: info?.property_name,
          task_type_name: taskMap.get(j.task_type_id),
          meta: { kind: "scheduled" },
        });
      }
    }

    if ((j.status === "done" || j.status === "cancelled") && j.closed_at) {
      const closedDate = j.closed_at.slice(0, 10);
      if (closedDate >= startStr && closedDate <= endStr && closedDate !== createdDate) {
        push(closedDate, {
          id: "job_closed_" + j.id,
          date: closedDate,
          type: eventType,
          title: "Closed: " + (taskMap.get(j.task_type_id) ?? "Job order") + " — " + (info?.unit_number ?? ""),
          subtitle: info?.property_name ?? "",
          priority: j.priority,
          status: j.status,
          cost: j.cost_estimate != null ? Number(j.cost_estimate) : undefined,
          href: "/maintenance/job-orders/" + j.id,
          unit_number: info?.unit_number,
          property_name: info?.property_name,
          task_type_name: taskMap.get(j.task_type_id),
          meta: { kind: "closed" },
        });
      }
    }
  }

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
  let overdueCount = 0;

  const today = ymd(new Date());

  for (const date of Object.keys(month.eventsByDate)) {
    for (const e of month.eventsByDate[date]) {
      counts[e.type] = (counts[e.type] ?? 0) + 1;
      if (e.cost) totalCost += e.cost;
      if (e.priority === "urgent" && e.status !== "done" && e.status !== "cancelled") urgentCount++;
      // Overdue: scheduled date is in the past, job not done
      if (
        e.meta?.kind === "scheduled" &&
        e.date < today &&
        e.status !== "done" &&
        e.status !== "cancelled"
      ) {
        overdueCount++;
      }
    }
  }

  return { counts, totalCost, urgentCount, overdueCount };
}

/**
 * Jobs that need attention right now:
 *  - Scheduled in the past but not done/cancelled (overdue)
 *  - Scheduled within the next N days
 *  - Urgent and still open/pending/in_progress
 */
export async function getUpcomingJobs(days = 7, property_id?: string | null) {
  const supabase = await createClient();
  const today = new Date();
  const todayStr = ymd(today);
  const cutoff = ymd(new Date(today.getTime() + days * 86400000));

  const { data: jobs } = await supabase
    .from("job_order")
    .select(
      "id, unit_id, task_type_id, priority, status, description, cost_estimate, scheduled_date"
    )
    .in("status", ["open", "pending_approval", "assigned", "in_progress"])
    .not("scheduled_date", "is", null)
    .lte("scheduled_date", cutoff)
    .order("scheduled_date", { ascending: true });

  const rows = (jobs ?? []) as any[];
  if (rows.length === 0) return [];

  const unitIds = Array.from(new Set(rows.map((r) => r.unit_id))).filter(Boolean);
  const taskTypeIds = Array.from(new Set(rows.map((r) => r.task_type_id))).filter(Boolean);

  const [{ data: units }, { data: types }] = await Promise.all([
    unitIds.length > 0
      ? supabase.from("unit").select("id, unit_number, property_id").in("id", unitIds)
      : Promise.resolve({ data: [] as any[] }),
    taskTypeIds.length > 0
      ? supabase.from("job_task_type").select("id, name").in("id", taskTypeIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const unitMap = new Map((units ?? []).map((u: any) => [u.id, u]));
  const taskMap = new Map((types ?? []).map((t: any) => [t.id, t.name]));

  const propIds = Array.from(new Set((units ?? []).map((u: any) => u.property_id))).filter(Boolean);
  const { data: props } = propIds.length > 0
    ? await supabase.from("property").select("id, name").in("id", propIds)
    : { data: [] as { id: string; name: string }[] };
  const propMap = new Map((props ?? []).map((p: any) => [p.id, p.name]));

  let result = rows.map((j) => {
    const u = unitMap.get(j.unit_id) as any;
    const isOverdue = j.scheduled_date < todayStr;
    const daysUntil = Math.ceil(
      (new Date(j.scheduled_date).getTime() - today.getTime()) / 86400000
    );
    return {
      id: j.id,
      scheduled_date: j.scheduled_date,
      days_until: daysUntil,
      is_overdue: isOverdue,
      priority: j.priority,
      status: j.status,
      task_type_name: taskMap.get(j.task_type_id) ?? "Job order",
      unit_number: u?.unit_number ?? "—",
      property_id: u?.property_id as string | undefined,
      property_name: u ? propMap.get(u.property_id) : undefined,
    };
  });

  if (property_id) {
    result = result.filter((r) => r.property_id === property_id);
  }

  return result;
}

/**
 * CSV export for a given month.
 */
export async function exportJobMonthCsv(
  year: number,
  month: number
): Promise<string> {
  const data = await getJobCalendarMonth(year, month, { statuses: [], priorities: [] });

  function escape(v: string): string {
    if (v.includes(",") || v.includes('"') || v.includes("\n")) {
      return '"' + v.replace(/"/g, '""') + '"';
    }
    return v;
  }

  const rows: string[] = [];
  rows.push(
    ["Date", "Kind", "Status", "Priority", "Title", "Unit", "Property", "Task", "Cost", "Link"]
      .map(escape)
      .join(",")
  );

  const dates = Object.keys(data.eventsByDate).sort();
  for (const date of dates) {
    for (const e of data.eventsByDate[date]) {
      rows.push(
        [
          e.date,
          String(e.meta?.kind ?? ""),
          e.status,
          e.priority,
          e.title,
          e.unit_number ?? "",
          e.property_name ?? "",
          e.task_type_name ?? "",
          e.cost != null ? e.cost.toFixed(2) : "",
          e.href ? (process.env.NEXT_PUBLIC_APP_URL ?? "") + e.href : "",
        ]
          .map(escape)
          .join(",")
      );
    }
  }

  return rows.join("\n");
}
`;

// =============================================================================
// 2. Week view
// =============================================================================
FILES["src/components/maintenance/calendar/job-week-view.tsx"] =
`"use client";

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
`;

// =============================================================================
// 3. Export menu
// =============================================================================
FILES["src/components/maintenance/calendar/job-export-menu.tsx"] =
`"use client";

import { useState } from "react";
import { Download, Printer, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";

export function JobExportMenu({ year, month }: { year: number; month: number }) {
  const [open, setOpen] = useState(false);

  function downloadCsv() {
    const url = "/api/maintenance/calendar/export?year=" + year + "&month=" + month;
    window.location.href = url;
    setOpen(false);
  }

  function printCalendar() {
    setOpen(false);
    setTimeout(() => window.print(), 100);
  }

  return (
    <div className="relative">
      <Button variant="secondary" onClick={() => setOpen((v) => !v)}>
        <Download className="mr-1.5 h-3.5 w-3.5" />
        Export
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1.5 min-w-[180px] rounded-lg border border-ink-200 bg-surface p-1 shadow-lg dark:border-white/[0.08] dark:bg-surface-raised">
            <button
              onClick={downloadCsv}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-ink-700 transition-colors hover:bg-ink-100 dark:text-ink-600 dark:hover:bg-white/[0.05]"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Download CSV
            </button>
            <button
              onClick={printCalendar}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-ink-700 transition-colors hover:bg-ink-100 dark:text-ink-600 dark:hover:bg-white/[0.05]"
            >
              <Printer className="h-4 w-4" />
              Print / Save PDF
            </button>
          </div>
        </>
      )}
    </div>
  );
}
`;

// =============================================================================
// 4. Event preview modal
// =============================================================================
FILES["src/components/maintenance/calendar/job-event-preview.tsx"] =
`"use client";

import Link from "next/link";
import { X, ExternalLink, Calendar, Building2, User, Banknote, Tag } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/dashboard/status-pill";
import { formatPHP } from "@/lib/utils/format-php";
import { JOB_EVENT_COLORS, JOB_EVENT_LABELS, PRIORITY_LABELS, type JobCalendarEvent } from "@/lib/maintenance/calendar-types";

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

const PRIORITY_TONE: Record<string, "gray" | "brand" | "yellow" | "red"> = {
  low: "gray",
  normal: "brand",
  high: "yellow",
  urgent: "red",
};

export function JobEventPreview({
  event,
  onClose,
}: {
  event: JobCalendarEvent | null;
  onClose: () => void;
}) {
  if (!event) return null;
  const colors = JOB_EVENT_COLORS[event.type];
  const kind = String(event.meta?.kind ?? "created");
  const kindLabel =
    kind === "created" ? "Created" : kind === "scheduled" ? "Scheduled" : "Closed";

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
            <div className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", colors.bg)}>
              <span className={cn("h-2.5 w-2.5 rounded-full", colors.dot)} />
            </div>
            <div className="min-w-0">
              <p className={cn("text-xs font-medium uppercase tracking-wider", colors.text)}>
                {kindLabel} · {JOB_EVENT_LABELS[event.type]}
              </p>
              <p className="mt-0.5 text-base font-semibold text-ink-900">{event.title}</p>
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
          <Row icon={<Calendar className="h-4 w-4" />} label="Date" value={formatDate(event.date)} />
          {event.task_type_name && (
            <Row icon={<Tag className="h-4 w-4" />} label="Task" value={event.task_type_name} />
          )}
          {event.unit_number && (
            <Row icon={<Building2 className="h-4 w-4" />} label="Unit" value={event.unit_number} />
          )}
          {event.property_name && (
            <Row icon={<Building2 className="h-4 w-4" />} label="Property" value={event.property_name} />
          )}
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center text-ink-400">
              <User className="h-4 w-4" />
            </span>
            <div className="flex-1">
              <p className="text-xs text-ink-500">Priority</p>
              <StatusPill tone={PRIORITY_TONE[event.priority] ?? "gray"} dot>
                {PRIORITY_LABELS[event.priority]}
              </StatusPill>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center text-ink-400">
              <span className="text-sm font-semibold">●</span>
            </span>
            <div className="flex-1">
              <p className="text-xs text-ink-500">Status</p>
              <StatusPill tone={colors.text.includes("danger") ? "red" : colors.text.includes("success") ? "green" : colors.text.includes("warning") ? "yellow" : "brand"} dot>
                {event.status.replace("_", " ")}
              </StatusPill>
            </div>
          </div>
          {event.cost != null && (
            <Row
              icon={<Banknote className="h-4 w-4" />}
              label="Cost estimate"
              value={formatPHP(event.cost)}
              highlight
            />
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-ink-200 px-5 py-3 dark:border-white/[0.06]">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          {event.href && (
            <Link href={event.href}>
              <Button>
                Open job order
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
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center text-ink-400">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-ink-500">{label}</p>
        <p className={cn("text-sm capitalize", highlight ? "font-semibold text-ink-900" : "text-ink-900")}>{value}</p>
      </div>
    </div>
  );
}
`;

// =============================================================================
// 5. Export API
// =============================================================================
FILES["src/app/api/maintenance/calendar/export/route.ts"] =
`import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { hasPermission } from "@/lib/auth/require-permission";
import { exportJobMonthCsv } from "@/lib/maintenance/calendar-aggregate";

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ok = await hasPermission("joborder:read");
  if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const year = Number(url.searchParams.get("year"));
  const month = Number(url.searchParams.get("month"));

  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return NextResponse.json({ error: "Invalid year/month" }, { status: 400 });
  }

  try {
    const csv = await exportJobMonthCsv(year, month);
    const filename = "job-orders-" + year + "-" + String(month).padStart(2, "0") + ".csv";

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="' + filename + '"',
      },
    });
  } catch (err) {
    console.error("[api/maintenance/calendar/export]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
`;

// =============================================================================
// 6. Calendar shell — 3 views, export, preview
// =============================================================================
FILES["src/components/maintenance/calendar/job-calendar-shell.tsx"] =
`"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, List, Calendar as CalendarIcon, CalendarRange } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { JobMonthGrid } from "./job-month-grid";
import { JobWeekView } from "./job-week-view";
import { JobListView } from "./job-list-view";
import { JobDayPanel } from "./job-day-panel";
import { JobEventPreview } from "./job-event-preview";
import { JobLegend } from "./job-legend";
import { JobCalendarFilters } from "./job-calendar-filters";
import { JobExportMenu } from "./job-export-menu";
import type { JobCalendarEvent, JobCalendarMonth } from "@/lib/maintenance/calendar-types";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type ViewMode = "month" | "week" | "list";

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
  const [preview, setPreview] = useState<JobCalendarEvent | null>(null);
  const [pending, setPending] = useState(false);

  const selectedProperty = searchParams.get("property");
  const statusesParam = searchParams.get("statuses") ?? "";
  const prioritiesParam = searchParams.get("priorities") ?? "";

  function updateQuery(next: {
    property?: string | null;
    statuses?: string | null;
    priorities?: string | null;
    view?: ViewMode;
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

  const selectedEvents = selectedDate ? month.eventsByDate[selectedDate] ?? [] : [];

  return (
    <div className="space-y-4">
      <JobCalendarFilters properties={properties} />

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
          <Button variant="ghost" onClick={today} disabled={pending}>
            Today
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-ink-200 p-0.5 dark:border-white/[0.06]">
            <ViewButton active={view === "month"} onClick={() => { setView("month"); updateQuery({ view: "month" }); }} icon={<CalendarIcon className="h-3.5 w-3.5" />} label="Month" />
            <ViewButton active={view === "week"} onClick={() => { setView("week"); updateQuery({ view: "week" }); }} icon={<CalendarRange className="h-3.5 w-3.5" />} label="Week" />
            <ViewButton active={view === "list"} onClick={() => { setView("list"); updateQuery({ view: "list" }); }} icon={<List className="h-3.5 w-3.5" />} label="List" />
          </div>

          <JobExportMenu year={month.year} month={month.month} />
        </div>
      </div>

      <JobLegend />

      {view === "month" && (
        <JobMonthGrid
          month={month}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onPreview={setPreview}
        />
      )}

      {view === "week" && (
        <JobWeekView month={month} anchorDate={anchorDate} onPreview={setPreview} />
      )}

      {view === "list" && <JobListView month={month} />}

      <JobDayPanel
        date={selectedDate}
        events={selectedEvents}
        onClose={() => setSelectedDate(null)}
        onPreview={setPreview}
      />

      <JobEventPreview event={preview} onClose={() => setPreview(null)} />
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
// 7. Calendar page — stat cards + upcoming banner
// =============================================================================
FILES["src/app/(dashboard)/maintenance/calendar/page.tsx"] =
`import Link from "next/link";
import { ArrowLeft, AlertTriangle, ArrowRight } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import {
  getJobCalendarMonth,
  summarizeJobMonth,
  getUpcomingJobs,
} from "@/lib/maintenance/calendar-aggregate";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { JobCalendarShell } from "@/components/maintenance/calendar/job-calendar-shell";
import { formatPHP } from "@/lib/utils/format-php";

export default async function MaintenanceCalendarPage() {
  await requirePagePermission("joborder:read");
  const supabase = await createClient();

  const now = new Date();

  const [month, properties, upcoming] = await Promise.all([
    getJobCalendarMonth(now.getFullYear(), now.getMonth() + 1, { statuses: [], priorities: [] }),
    supabase.from("property").select("id, name").is("archived_at", null).order("name"),
    getUpcomingJobs(7, null),
  ]);

  const summary = summarizeJobMonth(month);
  const total = Object.values(summary.counts).reduce((s, n) => s + n, 0);
  const overdue = upcoming.filter((j) => j.is_overdue);

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
          description="Job orders by date — open, scheduled, and completed."
        />
      </div>

      {/* Overdue / upcoming banner */}
      {overdue.length > 0 && (
        <Link
          href="/maintenance"
          className="flex items-center justify-between gap-4 rounded-xl border border-danger-500/30 bg-danger-500/5 px-4 py-3 transition-colors hover:bg-danger-500/10 dark:border-danger-500/20 dark:bg-danger-500/[0.06]"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-danger-500/15 text-danger-700 dark:text-danger-500">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-medium text-ink-900">
                {overdue.length} job order{overdue.length === 1 ? "" : "s"} overdue
              </p>
              <p className="text-xs text-ink-500">
                Scheduled in the past, still not completed
              </p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-danger-700 dark:text-danger-500" />
        </Link>
      )}

      {upcoming.length > 0 && upcoming.length > overdue.length && (
        <div className="text-xs text-ink-500">
          {upcoming.length - overdue.length} more job{upcoming.length - overdue.length === 1 ? "" : "s"} scheduled in the next 7 days.
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total jobs this month" value={total} accent="brand" />
        <StatCard label="Urgent" value={summary.urgentCount} accent="red" />
        <StatCard label="Overdue" value={summary.overdueCount} accent="yellow" />
        <StatCard label="Total cost" value={formatPHP(summary.totalCost)} accent="purple" />
      </div>

      <JobCalendarShell initial={month} properties={properties.data ?? []} />
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

  console.log("Job Order Calendar — full feature parity\\n");

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
  console.log("  Visit /maintenance/calendar");
}


main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});