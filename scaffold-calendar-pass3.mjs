#!/usr/bin/env node
/**
 * Tenant Payment Calendar — Pass 3 (Reminders + Polish)
 * Usage: node scaffold-calendar-pass3.mjs
 *
 * Creates:
 *   src/lib/calendar/reminders.ts
 *   src/components/calendar/event-preview.tsx
 *   src/components/shell/notification-bell.tsx
 *
 * Updates:
 *   src/lib/calendar/types.ts                  (add overdue flag support)
 *   src/components/calendar/event-chip.tsx     (overdue pulse, click opens preview)
 *   src/components/calendar/day-panel.tsx      (use EventPreview instead of navigation)
 *   src/components/calendar/month-grid.tsx     (pass onPreview handler)
 *   src/components/calendar/calendar-shell.tsx (preview modal state)
 *   src/components/shell/topbar.tsx            (wire NotificationBell)
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
// 1. Reminders aggregate
// =============================================================================
FILES["src/lib/calendar/reminders.ts"] =
`import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Reminder = {
  id: string;
  type: "invoice_overdue" | "lease_expiring" | "rent_due_soon";
  title: string;
  subtitle?: string;
  href: string;
  days: number;    // days until (or since) the event
  severity: "info" | "warning" | "danger";
};

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + day;
}

/**
 * Everything the user should know about right now:
 *  - Overdue invoices
 *  - Leases ending within 30 days
 *  - Rent dues in the next 3 days (from active leases)
 */
export async function getReminders(): Promise<Reminder[]> {
  const supabase = await createClient();
  const today = new Date();
  const todayStr = ymd(today);
  const in30 = ymd(new Date(today.getTime() + 30 * 86400000));
  const in3 = ymd(new Date(today.getTime() + 3 * 86400000));
  const reminders: Reminder[] = [];

  // ---- Overdue invoices ----
  const { data: overdue } = await supabase
    .from("invoice")
    .select("id, display_number, amount, due_date, lease_id")
    .eq("status", "overdue")
    .order("due_date", { ascending: true })
    .limit(20);

  for (const inv of overdue ?? []) {
    const days = Math.ceil(
      (today.getTime() - new Date(inv.due_date).getTime()) / 86400000
    );
    reminders.push({
      id: "inv_" + inv.id,
      type: "invoice_overdue",
      title: (inv.display_number ?? "Invoice") + " is overdue",
      subtitle: days + " day" + (days === 1 ? "" : "s") + " past due",
      href: "/accounting/invoices/" + inv.id,
      days,
      severity: days > 30 ? "danger" : "warning",
    });
  }

  // ---- Leases expiring soon ----
  const { data: expiring } = await supabase
    .from("lease")
    .select("id, end_date, tenant_name, unit_number")
    .eq("status", "active")
    .gte("end_date", todayStr)
    .lte("end_date", in30)
    .order("end_date", { ascending: true })
    .limit(20);

  for (const l of expiring ?? []) {
    const days = Math.ceil(
      (new Date(l.end_date).getTime() - today.getTime()) / 86400000
    );
    reminders.push({
      id: "lease_" + l.id,
      type: "lease_expiring",
      title: "Lease ending — " + (l.tenant_name ?? "Tenant"),
      subtitle:
        (l.unit_number ? "Unit " + l.unit_number + " · " : "") +
        days + " day" + (days === 1 ? "" : "s") + " left",
      href: "/property/leases/" + l.id,
      days,
      severity: days <= 7 ? "danger" : "warning",
    });
  }

  // ---- Rent dues in the next 3 days ----
  const { data: upcoming } = await supabase
    .from("lease")
    .select("id, due_date, monthly_rent, tenant_name, unit_number, status, start_date, end_date")
    .in("status", ["active", "expiring"]);

  for (const l of upcoming ?? []) {
    if (!l.due_date) continue;

    // Compute this month's due date
    const dueDay = Number(l.due_date.slice(8, 10));
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const safeDay = Math.min(dueDay, lastDay);
    const dueThisMonth = new Date(now.getFullYear(), now.getMonth(), safeDay);

    // If it's already past, look at next month
    let dueDate = dueThisMonth;
    if (dueDate < today) {
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const nmLast = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
      dueDate = new Date(
        nextMonth.getFullYear(),
        nextMonth.getMonth(),
        Math.min(dueDay, nmLast)
      );
    }

    // Skip if outside lease term
    if (dueDate < new Date(l.start_date) || dueDate > new Date(l.end_date)) continue;

    const daysUntil = Math.ceil(
      (dueDate.getTime() - today.getTime()) / 86400000
    );
    if (daysUntil > 3 || daysUntil < 0) continue;

    reminders.push({
      id: "rent_" + l.id + "_" + ymd(dueDate),
      type: "rent_due_soon",
      title: "Rent due soon — " + (l.tenant_name ?? "Tenant"),
      subtitle:
        (l.unit_number ? "Unit " + l.unit_number + " · " : "") +
        (daysUntil === 0
          ? "Due today"
          : daysUntil === 1
          ? "Due tomorrow"
          : "Due in " + daysUntil + " days"),
      href: "/property/leases/" + l.id,
      days: daysUntil,
      severity: daysUntil <= 1 ? "warning" : "info",
    });
  }

  // Sort: most urgent first
  reminders.sort((a, b) => {
    const sevOrder = { danger: 0, warning: 1, info: 2 };
    const sev = sevOrder[a.severity] - sevOrder[b.severity];
    if (sev !== 0) return sev;
    return a.days - b.days;
  });

  return reminders;
}
`;

// =============================================================================
// 2. Event preview modal
// =============================================================================
FILES["src/components/calendar/event-preview.tsx"] =
`"use client";

import Link from "next/link";
import { X, ExternalLink, Calendar, Building2 } from "lucide-react";
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
// 3. Notification bell
// =============================================================================
FILES["src/components/shell/notification-bell.tsx"] =
`"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, AlertTriangle, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { Reminder } from "@/lib/calendar/reminders";

const SEVERITY_ICON = {
  danger: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const SEVERITY_COLOR = {
  danger: "text-danger-600 dark:text-danger-500",
  warning: "text-warning-600 dark:text-warning-500",
  info: "text-info-600 dark:text-info-500",
};

export function NotificationBell({ reminders }: { reminders: Reminder[] }) {
  const [open, setOpen] = useState(false);
  const count = reminders.length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className="relative rounded-lg p-2 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900 dark:hover:bg-white/[0.05]"
      >
        <Bell className="h-[18px] w-[18px]" />
        {count > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-500 px-1 text-[10px] font-semibold text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border border-ink-200 bg-surface shadow-lg dark:border-white/[0.08] dark:bg-surface-raised">
            <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3 dark:border-white/[0.06]">
              <p className="text-sm font-semibold text-ink-900">Notifications</p>
              {count > 0 && (
                <span className="text-xs text-ink-500">
                  {count} item{count === 1 ? "" : "s"}
                </span>
              )}
            </div>

            {count === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-ink-500">
                You're all caught up.
              </div>
            ) : (
              <ul className="max-h-96 divide-y divide-ink-100 overflow-y-auto dark:divide-white/[0.04]">
                {reminders.slice(0, 15).map((r) => {
                  const Icon = SEVERITY_ICON[r.severity];
                  return (
                    <li key={r.id}>
                      <Link
                        href={r.href}
                        onClick={() => setOpen(false)}
                        className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-ink-50 dark:hover:bg-white/[0.03]"
                      >
                        <Icon
                          className={cn(
                            "mt-0.5 h-4 w-4 shrink-0",
                            SEVERITY_COLOR[r.severity]
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink-900">
                            {r.title}
                          </p>
                          {r.subtitle && (
                            <p className="mt-0.5 truncate text-xs text-ink-500">
                              {r.subtitle}
                            </p>
                          )}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}

            {count > 15 && (
              <div className="border-t border-ink-100 px-4 py-2 text-center text-xs text-ink-500 dark:border-white/[0.06]">
                + {count - 15} more
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
`;

// =============================================================================
// 4. Update event-chip — pulse when overdue, add onClick for preview
// =============================================================================
FILES["src/components/calendar/event-chip.tsx"] =
`"use client";

import { cn } from "@/lib/utils/cn";
import { formatPHP } from "@/lib/utils/format-php";
import { TYPE_COLORS, type CalendarEvent } from "@/lib/calendar/types";

export function EventChip({
  event,
  variant = "compact",
  onPreview,
}: {
  event: CalendarEvent;
  variant?: "compact" | "full";
  onPreview?: (e: CalendarEvent) => void;
}) {
  const colors = TYPE_COLORS[event.type];
  const isOverdue = event.type === "invoice_due" && event.status === "overdue";

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
          "group flex w-full items-center gap-1.5 truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium",
          colors.bg,
          colors.text,
          isOverdue && "ring-1 ring-danger-500/60 animate-pulse-slow"
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
        isOverdue && "ring-1 ring-danger-500/60"
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
    </button>
  );
}
`;

// =============================================================================
// 5. Update day panel — preview instead of link navigation
// =============================================================================
FILES["src/components/calendar/day-panel.tsx"] =
`"use client";

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
`;

// =============================================================================
// 6. Update month-grid — pass onPreview handler
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
                  <EventChip key={e.id} event={e} variant="compact" onPreview={onPreview} />
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
// 7. Update calendar shell — preview modal + wire up
// =============================================================================
FILES["src/components/calendar/calendar-shell.tsx"] =
`"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, List, Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { MonthGrid } from "./month-grid";
import { ListView } from "./list-view";
import { DayPanel } from "./day-panel";
import { EventPreview } from "./event-preview";
import { Legend } from "./legend";
import { CalendarFilters } from "./calendar-filters";
import { ExpiringBanner } from "./expiring-banner";
import {
  ALL_TYPES,
  type CalendarEvent,
  type CalendarEventType,
  type CalendarMonth,
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

  const [month, setMonth] = useState<CalendarMonth>(initial);
  const [view, setView] = useState<"month" | "list">(
    (searchParams.get("view") as "month" | "list") ?? "month"
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [preview, setPreview] = useState<CalendarEvent | null>(null);
  const [pending, setPending] = useState(false);

  const selectedProperty = searchParams.get("property");
  const typesParam = searchParams.get("types") ?? "";
  const selectedTypes: CalendarEventType[] = typesParam
    ? (typesParam.split(",").filter((t) => ALL_TYPES.includes(t as CalendarEventType)) as CalendarEventType[])
    : [];

  function updateQuery(next: {
    property?: string | null;
    types?: CalendarEventType[];
    view?: "month" | "list";
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
    setPending(true);

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
      })
      .finally(() => {
        if (!cancelled) setPending(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProperty, typesParam, month.year, month.month]);

  async function goToMonth(year: number, m: number) {
    setPending(true);
    try {
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
      </div>

      <Legend />

      {view === "month" ? (
        <MonthGrid
          month={month}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onPreview={setPreview}
        />
      ) : (
        <ListView month={month} />
      )}

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
`;

// =============================================================================
// 8. Update topbar — wire NotificationBell
// =============================================================================
FILES["src/components/shell/topbar.tsx"] =
`"use client";

import { useEffect, useState } from "react";
import { Moon, Sun, Monitor, Plus } from "lucide-react";
import { useTheme } from "next-themes";
import { SearchBar } from "./search-bar";
import { RolePill } from "./role-badge";
import { NotificationBell } from "./notification-bell";
import type { UserRole } from "@/lib/auth/get-user-roles";
import type { Reminder } from "@/lib/calendar/reminders";

export function Topbar({
  roles,
  reminders,
}: {
  roles: UserRole[];
  reminders: Reminder[];
}) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const toggleTheme = () => {
    const next =
      theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
    setTheme(next);
  };

  const ThemeIcon = !mounted
    ? Sun
    : theme === "light"
    ? Sun
    : theme === "dark"
    ? Moon
    : Monitor;

  return (
    <div className="flex h-16 items-center gap-4 px-6">
      <div className="flex flex-1 items-center gap-4">
        <SearchBar />
      </div>

      <div className="flex items-center gap-2">
        <RolePill roles={roles} />

        <div className="mx-1 h-6 w-px bg-ink-200 dark:bg-white/[0.08]" />

        <NotificationBell reminders={reminders} />

        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="rounded-lg p-2 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900 dark:hover:bg-white/[0.05]"
        >
          <ThemeIcon className="h-[18px] w-[18px]" />
        </button>

        <div className="mx-1 h-6 w-px bg-ink-200 dark:bg-white/[0.08]" />

        <button className="hidden h-9 items-center gap-1.5 rounded-lg bg-brand-500 px-3.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 sm:inline-flex">
          <Plus className="h-4 w-4" />
          Quick action
        </button>
      </div>
    </div>
  );
}
`;

// =============================================================================
// 9. Update dashboard layout — fetch reminders, pass to Topbar
// =============================================================================
FILES["src/app/(dashboard)/layout.tsx"] =
`import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/get-session";
import { getUserRoles } from "@/lib/auth/get-user-roles";
import { getReminders } from "@/lib/calendar/reminders";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();
  if (!user) redirect("/login");

  const roles = await getUserRoles();

  // Load reminders for the bell — fail silently if anything goes wrong
  let reminders = [] as Awaited<ReturnType<typeof getReminders>>;
  try {
    reminders = await getReminders();
  } catch (err) {
    console.error("[layout] failed to load reminders", err);
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar border-r border-ink-200/60 bg-surface dark:border-white/[0.06]">
        <Sidebar roles={roles} email={user.email ?? ""} />
      </aside>

      <header className="app-header border-b border-ink-200/60 bg-surface/80 backdrop-blur-md dark:border-white/[0.06] dark:bg-surface/70">
        <Topbar roles={roles} reminders={reminders} />
      </header>

      <main className="app-main">
        <div className="mx-auto max-w-[1500px] p-6 lg:p-8">
          {children}
        </div>
      </main>
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

  console.log("Tenant Payment Calendar — Pass 3\n");

  let count = 0;
  for (const [relPath, content] of Object.entries(FILES)) {
    const full = join(ROOT, relPath);
    const exists_ = await exists(full);
    console.log((exists_ ? "  ~ " : "  + ") + relPath);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, content, "utf8");
    count++;
  }

  // Add pulse-slow keyframe to tailwind config if not present
  const twPath = join(ROOT, "tailwind.config.ts");
  if (await exists(twPath)) {
    const tw = await import("node:fs/promises").then((fs) =>
      fs.readFile(twPath, "utf8")
    );
    if (!tw.includes("pulse-slow")) {
      const updated = tw.replace(
        /(keyframes:\s*\{)/,
        `$1
        "pulse-slow": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },`
      ).replace(
        /(animation:\s*\{)/,
        `$1
        "pulse-slow": "pulse-slow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",`
      );
      await writeFile(twPath, updated, "utf8");
      console.log("  ~ tailwind.config.ts  (added pulse-slow animation)");
    }
  }

  console.log("\nDone — " + count + " file(s) written.\n");
  console.log("Next:");
  console.log("  npm run typecheck");
  console.log("  npm run dev");
  console.log("\nWhat's new:");
  console.log("  - Notification bell shows overdue invoices, expiring leases, upcoming rent");
  console.log("  - Overdue invoices pulse in the calendar grid");
  console.log("  - Click any event chip → preview modal with details + Open button");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});