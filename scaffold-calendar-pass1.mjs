#!/usr/bin/env node
/**
 * Tenant Payment Calendar — Pass 1
 * Usage: node scaffold-calendar-pass1.mjs
 *
 * Creates:
 *   src/lib/calendar/types.ts
 *   src/lib/calendar/aggregate.ts
 *   src/app/(dashboard)/accounting/calendar/page.tsx
 *   src/app/(dashboard)/accounting/calendar/actions.ts
 *   src/app/(dashboard)/property/calendar/page.tsx
 *   src/components/calendar/month-grid.tsx
 *   src/components/calendar/list-view.tsx
 *   src/components/calendar/calendar-shell.tsx
 *   src/components/calendar/day-panel.tsx
 *   src/components/calendar/event-chip.tsx
 *   src/components/calendar/legend.tsx
 *
 * Updates:
 *   src/components/shell/sidebar.tsx  (add Calendar links)
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
FILES["src/lib/calendar/types.ts"] =
`export type CalendarEventType =
  | "rent_due"
  | "invoice_due"
  | "lease_starting"
  | "lease_ending"
  | "payment";

export type CalendarEvent = {
  id: string;
  date: string; // YYYY-MM-DD
  type: CalendarEventType;
  title: string;
  subtitle?: string;   // tenant + unit
  amount?: number;
  status?: string;     // for invoices: unpaid, overdue, paid
  href?: string;
  property_id?: string;
  property_name?: string;
  meta?: Record<string, string | number | undefined>;
};

export type CalendarMonth = {
  year: number;
  month: number; // 1-12
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
// 2. Aggregation
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

/**
 * Generate the day-of-month for a recurring due date.
 * If the lease started on the 31st and the month has 30 days, clamp to 30.
 */
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

  // -------- Leases (covers rent_due, lease_starting, lease_ending) --------
  let leaseQuery = supabase
    .from("lease")
    .select(
      "id, unit_id, tenant_id, start_date, end_date, due_date, monthly_rent, status, unit_number, tenant_name"
    );

  const { data: leaseRows } = await leaseQuery;
  const leases = (leaseRows ?? []) as any[];

  // Fetch unit + property info for filtering and display
  const unitIds = Array.from(new Set(leases.map((l) => l.unit_id))).filter(Boolean);
  const unitLookup = new Map<string, { unit_number?: string; property_id?: string; property_name?: string }>();

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

  // Filter leases by property if requested
  const filteredLeases = leases.filter((l) => {
    if (!filters.property_id) return true;
    const info = unitLookup.get(l.unit_id);
    return info?.property_id === filters.property_id;
  });

  // -------- Invoices --------
  let invoiceQuery = supabase
    .from("invoice")
    .select("id, lease_id, type, amount, due_date, status, display_number")
    .gte("due_date", startStr)
    .lte("due_date", endStr);

  const { data: invoiceRows } = await invoiceQuery;
  const invoices = (invoiceRows ?? []) as any[];

  // Map invoices back to leases for tenant/unit info
  const leaseIds = Array.from(new Set(invoices.map((i) => i.lease_id))).filter(Boolean);
  const leaseMap = new Map<string, any>();
  for (const l of leases) leaseMap.set(l.id, l);

  // Fetch missing leases referenced by invoices but not in the main set
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

  // -------- Payments --------
  const startTs = startStr + "T00:00:00.000Z";
  const endTs = endStr + "T23:59:59.999Z";

  const { data: paymentRows } = await supabase
    .from("payment")
    .select("id, invoice_id, amount, method, paid_at, receipt_number")
    .gte("paid_at", startTs)
    .lte("paid_at", endTs);

  const payments = (paymentRows ?? []) as any[];

  // Map payments -> invoices -> leases for tenant info
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

  // -------- Build events --------
  const eventsByDate: Record<string, CalendarEvent[]> = {};

  function push(date: string, evt: CalendarEvent) {
    if (!eventsByDate[date]) eventsByDate[date] = [];
    eventsByDate[date].push(evt);
  }

  // Recurring rent due — for every active lease with a due_date, generate event(s)
  if (shouldInclude("rent_due")) {
    for (const l of filteredLeases) {
      if (!l.due_date) continue;
      if (l.status !== "active" && l.status !== "expiring") continue;
      const dueDay = Number(l.due_date.slice(8, 10));
      if (!dueDay) continue;

      // Only generate for months within the lease term
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
        property_id: info?.property_id,
        property_name: info?.property_name,
      });
    }
  }

  // Invoice due — real billed invoices with due date in this month
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
        property_id: info?.property_id,
        property_name: info?.property_name,
      });
    }
  }

  // Lease starting
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
        property_id: info?.property_id,
        property_name: info?.property_name,
      });
    }
  }

  // Lease ending
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
        property_id: info?.property_id,
        property_name: info?.property_name,
      });
    }
  }

  // Payments
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
        subtitle: inv?.display_number
          ? "Invoice " + inv.display_number
          : undefined,
        amount: Number(p.amount ?? 0),
        href: "/accounting/payments/" + p.id + "/receipt",
        property_id: info?.property_id,
        property_name: info?.property_name,
      });
    }
  }

  // Sort each day's events by type for consistency
  const order: CalendarEvent["type"][] = [
    "rent_due",
    "invoice_due",
    "lease_ending",
    "lease_starting",
    "payment",
  ];
  for (const date of Object.keys(eventsByDate)) {
    eventsByDate[date].sort(
      (a, b) => order.indexOf(a.type) - order.indexOf(b.type)
    );
  }

  return { year, month, eventsByDate };
}

/**
 * Get a lightweight summary of the current month: counts by type.
 */
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
`;

// =============================================================================
// 3. Server actions (used later for filters etc — placeholder for Pass 2)
// =============================================================================
FILES["src/app/(dashboard)/accounting/calendar/actions.ts"] =
`"use server";

import { assertPermission } from "@/lib/auth/guard";
import { getCalendarMonth } from "@/lib/calendar/aggregate";
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
`;

// =============================================================================
// 4. Event chip
// =============================================================================
FILES["src/components/calendar/event-chip.tsx"] =
`import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import { formatPHP } from "@/lib/utils/format-php";
import { TYPE_COLORS, type CalendarEvent } from "@/lib/calendar/types";

export function EventChip({
  event,
  variant = "compact",
}: {
  event: CalendarEvent;
  variant?: "compact" | "full";
}) {
  const colors = TYPE_COLORS[event.type];

  if (variant === "compact") {
    return (
      <div
        className={cn(
          "group flex items-center gap-1.5 truncate rounded px-1.5 py-0.5 text-[11px] font-medium",
          colors.bg,
          colors.text
        )}
        title={event.title}
      >
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", colors.dot)} />
        <span className="truncate">{event.title}</span>
      </div>
    );
  }

  return (
    <Link
      href={event.href ?? "#"}
      className={cn(
        "flex items-start gap-2.5 rounded-lg border px-3 py-2.5 transition-colors hover:bg-ink-50 dark:hover:bg-white/[0.03]",
        colors.border
      )}
    >
      <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", colors.dot)} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink-900">{event.title}</p>
        {event.subtitle && (
          <p className="truncate text-xs text-ink-500">{event.subtitle}</p>
        )}
        {event.amount != null && (
          <p className={cn("mt-0.5 text-xs font-semibold", colors.text)}>
            {formatPHP(event.amount)}
          </p>
        )}
      </div>
    </Link>
  );
}
`;

// =============================================================================
// 5. Day panel
// =============================================================================
FILES["src/components/calendar/day-panel.tsx"] =
`"use client";

import { X, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils/cn";
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
}: {
  date: string | null;
  events: CalendarEvent[];
  onClose: () => void;
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
                <EventChip event={e} variant="full" />
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
// 6. Month grid
// =============================================================================
FILES["src/components/calendar/month-grid.tsx"] =
`"use client";

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
}: {
  month: CalendarMonth;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
}) {
  const { year, month: m, eventsByDate } = month;
  const firstOfMonth = new Date(year, m - 1, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, m, 0).getDate();
  const daysInPrevMonth = new Date(year, m - 1, 0).getDate();

  // Today's date in YMD for highlight
  const now = new Date();
  const todayYmd = ymd(now.getFullYear(), now.getMonth() + 1, now.getDate());

  // Build grid cells: 6 weeks × 7 = 42 cells
  const cells: { date: string; day: number; current: boolean }[] = [];

  // Leading days from previous month
  for (let i = startWeekday - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    const prevMonth = m === 1 ? 12 : m - 1;
    const prevYear = m === 1 ? year - 1 : year;
    cells.push({ date: ymd(prevYear, prevMonth, day), day, current: false });
  }
  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: ymd(year, m, d), day: d, current: true });
  }
  // Trailing days
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    const nextMonth = m === 12 ? 1 : m + 1;
    const nextYear = m === 12 ? year + 1 : year;
    cells.push({ date: ymd(nextYear, nextMonth, d), day: d, current: false });
  }

  return (
    <div className="overflow-hidden rounded-xl border border-ink-200 bg-surface dark:border-white/[0.06]">
      {/* Weekday header */}
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

      {/* Grid */}
      <div className="grid grid-cols-7">
        {cells.map((cell, i) => {
          const events = eventsByDate[cell.date] ?? [];
          const isToday = cell.date === todayYmd;
          const isSelected = cell.date === selectedDate;

          return (
            <button
              key={i}
              onClick={() => onSelectDate(cell.date)}
              className={cn(
                "group relative flex min-h-[110px] flex-col gap-1 border-b border-r border-ink-200 p-1.5 text-left transition-colors dark:border-white/[0.06]",
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
                  <EventChip key={e.id} event={e} variant="compact" />
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
`;

// =============================================================================
// 7. List view
// =============================================================================
FILES["src/components/calendar/list-view.tsx"] =
`import { EventChip } from "./event-chip";
import { Card, CardBody } from "@/components/ui/card";
import type { CalendarEvent, CalendarMonth } from "@/lib/calendar/types";

function formatDay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function ListView({ month }: { month: CalendarMonth }) {
  const dates = Object.keys(month.eventsByDate).sort();

  if (dates.length === 0) {
    return (
      <Card>
        <CardBody className="py-16 text-center text-sm text-ink-500">
          No events this month.
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
                <p className="text-sm font-semibold text-ink-900">
                  {formatDay(date)}
                </p>
                <p className="text-xs text-ink-500">
                  {events.length} event{events.length === 1 ? "" : "s"}
                </p>
              </div>
              <ul className="divide-y divide-ink-100 dark:divide-white/[0.04]">
                {events.map((e) => (
                  <li key={e.id}>
                    <EventChip event={e} variant="full" />
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
// 8. Legend
// =============================================================================
FILES["src/components/calendar/legend.tsx"] =
`import { cn } from "@/lib/utils/cn";
import { ALL_TYPES, TYPE_COLORS, TYPE_LABELS } from "@/lib/calendar/types";

export function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      {ALL_TYPES.map((type) => (
        <div key={type} className="flex items-center gap-2 text-xs text-ink-600">
          <span className={cn("h-2 w-2 rounded-full", TYPE_COLORS[type].dot)} />
          {TYPE_LABELS[type]}
        </div>
      ))}
    </div>
  );
}
`;

// =============================================================================
// 9. Calendar shell (client component)
// =============================================================================
FILES["src/components/calendar/calendar-shell.tsx"] =
`"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, List, Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { MonthGrid } from "./month-grid";
import { ListView } from "./list-view";
import { DayPanel } from "./day-panel";
import { Legend } from "./legend";
import type { CalendarMonth } from "@/lib/calendar/types";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function CalendarShell({ initial }: { initial: CalendarMonth }) {
  const [month, setMonth] = useState<CalendarMonth>(initial);
  const [view, setView] = useState<"month" | "list">("month");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function goToMonth(year: number, m: number) {
    setPending(true);
    try {
      const res = await fetch(
        "/api/calendar/month?year=" + year + "&month=" + m,
        { cache: "no-store" }
      );
      if (res.ok) {
        const data = (await res.json()) as CalendarMonth;
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
      {/* Toolbar */}
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

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-ink-200 p-0.5 dark:border-white/[0.06]">
            <button
              onClick={() => setView("month")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                view === "month"
                  ? "bg-brand-500 text-white"
                  : "text-ink-600 hover:bg-ink-100 dark:hover:bg-white/[0.05]"
              )}
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              Month
            </button>
            <button
              onClick={() => setView("list")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                view === "list"
                  ? "bg-brand-500 text-white"
                  : "text-ink-600 hover:bg-ink-100 dark:hover:bg-white/[0.05]"
              )}
            >
              <List className="h-3.5 w-3.5" />
              List
            </button>
          </div>
        </div>
      </div>

      {/* Legend */}
      <Legend />

      {/* Body */}
      {view === "month" ? (
        <MonthGrid month={month} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
      ) : (
        <ListView month={month} />
      )}

      {/* Day panel */}
      <DayPanel
        date={selectedDate}
        events={selectedEvents}
        onClose={() => setSelectedDate(null)}
      />
    </div>
  );
}
`;

// =============================================================================
// 10. API route for month switching (client fetches)
// =============================================================================
FILES["src/app/api/calendar/month/route.ts"] =
`import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { hasPermission } from "@/lib/auth/require-permission";
import { getCalendarMonth } from "@/lib/calendar/aggregate";

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ok = await hasPermission("invoice:read");
  if (!ok) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const year = Number(url.searchParams.get("year"));
  const month = Number(url.searchParams.get("month"));

  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Invalid year or month" }, { status: 400 });
  }

  try {
    const data = await getCalendarMonth(year, month, { types: [] });
    return NextResponse.json(data);
  } catch (err) {
    console.error("[api/calendar/month]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
`;

// =============================================================================
// 11. Page — Accounting route
// =============================================================================
FILES["src/app/(dashboard)/accounting/calendar/page.tsx"] =
`import { requirePagePermission } from "@/lib/auth/guard";
import { getCalendarMonth, summarizeMonth } from "@/lib/calendar/aggregate";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { CalendarShell } from "@/components/calendar/calendar-shell";
import { formatPHP } from "@/lib/utils/format-php";

export default async function AccountingCalendarPage() {
  await requirePagePermission("invoice:read");

  const now = new Date();
  const month = await getCalendarMonth(now.getFullYear(), now.getMonth() + 1, { types: [] });
  const summary = summarizeMonth(month);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        description="Rent dues, invoices, lease events, and payments."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total due this month" value={formatPHP(summary.totalDue)} accent="yellow" />
        <StatCard label="Collected this month" value={formatPHP(summary.totalPaid)} accent="green" />
        <StatCard label="Overdue invoices" value={summary.overdue} accent="red" />
        <StatCard label="Events" value={Object.values(summary.counts).reduce((s, n) => s + n, 0)} accent="brand" />
      </div>

      <CalendarShell initial={month} />
    </div>
  );
}
`;

// =============================================================================
// 12. Page — Property route (same component)
// =============================================================================
FILES["src/app/(dashboard)/property/calendar/page.tsx"] =
`import { requirePagePermission } from "@/lib/auth/guard";
import { getCalendarMonth, summarizeMonth } from "@/lib/calendar/aggregate";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { CalendarShell } from "@/components/calendar/calendar-shell";
import { formatPHP } from "@/lib/utils/format-php";

export default async function PropertyCalendarPage() {
  await requirePagePermission("lease:read");

  const now = new Date();
  const month = await getCalendarMonth(now.getFullYear(), now.getMonth() + 1, { types: [] });
  const summary = summarizeMonth(month);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        description="Rent dues, lease events, and payments across properties."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total due this month" value={formatPHP(summary.totalDue)} accent="yellow" />
        <StatCard label="Collected this month" value={formatPHP(summary.totalPaid)} accent="green" />
        <StatCard label="Overdue invoices" value={summary.overdue} accent="red" />
        <StatCard label="Events" value={Object.values(summary.counts).reduce((s, n) => s + n, 0)} accent="brand" />
      </div>

      <CalendarShell initial={month} />
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

  console.log("Tenant Payment Calendar — Pass 1\n");

  let count = 0;
  for (const [relPath, content] of Object.entries(FILES)) {
    const full = join(ROOT, relPath);
    const exists_ = await exists(full);
    console.log((exists_ ? "  ~ " : "  + ") + relPath);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, content, "utf8");
    count++;
  }

  // Add Calendar links to sidebar
  const sidebarPath = join(ROOT, "src/components/shell/sidebar.tsx");
  if (await exists(sidebarPath)) {
    let src = await readFile(sidebarPath, "utf8");
    if (!src.includes('"/accounting/calendar"')) {
      // Add under Accounting group, before Approvals
      src = src.replace(
        /(\{\s*href:\s*"\/accounting\/approvals"[^}]+\},)/,
        '{ href: "/accounting/calendar",  label: "Calendar",  icon: CalendarIcon, roles: ["accounting", "executive"] },\n      $1'
      );
      // Add under Property group (after leases entry)
      src = src.replace(
        /(\{\s*href:\s*"\/property\/leases"[^}]+\},)/,
        '$1\n      { href: "/property/calendar",    label: "Calendar",    icon: CalendarIcon, roles: ["property_rep", "executive"] },'
      );
      // Add CalendarIcon import
      if (!src.includes("CalendarIcon")) {
        src = src.replace(
          /(\s*BarChart3,\s*\n)/,
          "$1  Calendar as CalendarIcon,\n"
        );
      }
      await writeFile(sidebarPath, src, "utf8");
      console.log("  ~ src/components/shell/sidebar.tsx  (added Calendar links)");
    }
  }

  console.log("\nDone — " + count + " file(s) written.\n");
  console.log("Next:");
  console.log("  npm run typecheck");
  console.log("  npm run dev");
  console.log("  Visit http://localhost:3000/accounting/calendar");
  console.log("  or   http://localhost:3000/property/calendar");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});