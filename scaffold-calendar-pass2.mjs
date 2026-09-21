#!/usr/bin/env node
/**
 * Tenant Payment Calendar — Pass 2 (Filters + Summary bar)
 * Usage: node scaffold-calendar-pass2.mjs
 *
 * Creates:
 *   src/components/calendar/calendar-filters.tsx
 *   src/components/calendar/expiring-banner.tsx
 *
 * Updates:
 *   src/app/api/calendar/month/route.ts        (accept property + types filters)
 *   src/components/calendar/calendar-shell.tsx (wire filters + URL sync + banner)
 *   src/lib/calendar/aggregate.ts              (add getExpiringSoon helper)
 *   src/app/(dashboard)/accounting/calendar/page.tsx
 *   src/app/(dashboard)/property/calendar/page.tsx
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
// 1. Extend aggregate.ts — add getExpiringSoon
// =============================================================================
FILES["src/lib/calendar/aggregate.ts"] = `import "server-only";
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

/**
 * Leases expiring within the next N days.
 * Used for the alert banner.
 */
export async function getExpiringSoon(days = 30, property_id?: string | null) {
  const supabase = await createClient();
  const today = new Date();
  const cutoff = new Date(today.getTime() + days * 86400000);

  const todayStr = ymd(today);
  const cutoffStr = ymd(cutoff);

  const { data: leases } = await supabase
    .from("lease")
    .select(
      "id, unit_id, end_date, monthly_rent, tenant_name, status"
    )
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

// =============================================================================
// 2. Filters component
// =============================================================================
FILES["src/components/calendar/calendar-filters.tsx"] =
`"use client";

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
`;

// =============================================================================
// 3. Expiring banner
// =============================================================================
FILES["src/components/calendar/expiring-banner.tsx"] =
`import Link from "next/link";
import { AlertCircle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function ExpiringBanner({
  count,
  days,
  href,
}: {
  count: number;
  days: number;
  href: string;
}) {
  if (count === 0) return null;

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center justify-between gap-4 rounded-xl border border-warning-500/30 bg-warning-500/5 px-4 py-3 transition-colors hover:bg-warning-500/10",
        "dark:border-warning-500/20 dark:bg-warning-500/[0.06] dark:hover:bg-warning-500/10"
      )}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-warning-500/15 text-warning-700 dark:text-warning-500">
          <AlertCircle className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-medium text-ink-900">
            {count} lease{count === 1 ? "" : "s"} expiring within {days} days
          </p>
          <p className="text-xs text-ink-500">
            Review and reach out for renewals before they lapse
          </p>
        </div>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-warning-700 dark:text-warning-500" />
    </Link>
  );
}
`;

// =============================================================================
// 4. Update API route — accept filters
// =============================================================================
FILES["src/app/api/calendar/month/route.ts"] =
`import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { hasPermission } from "@/lib/auth/require-permission";
import { getCalendarMonth } from "@/lib/calendar/aggregate";
import { ALL_TYPES, type CalendarEventType } from "@/lib/calendar/types";

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
  const propertyId = url.searchParams.get("property");
  const typesParam = url.searchParams.get("types") ?? "";

  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Invalid year or month" }, { status: 400 });
  }

  const types: CalendarEventType[] = typesParam
    ? (typesParam.split(",").filter((t) => ALL_TYPES.includes(t as CalendarEventType)) as CalendarEventType[])
    : [];

  try {
    const data = await getCalendarMonth(year, month, {
      property_id: propertyId || null,
      types,
    });
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
// 5. Update calendar shell — wire filters + URL sync
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
import { Legend } from "./legend";
import { CalendarFilters } from "./calendar-filters";
import { ExpiringBanner } from "./expiring-banner";
import {
  ALL_TYPES,
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
  const [pending, setPending] = useState(false);

  const selectedProperty = searchParams.get("property");
  const typesParam = searchParams.get("types") ?? "";
  const selectedTypes: CalendarEventType[] = typesParam
    ? (typesParam.split(",").filter((t) => ALL_TYPES.includes(t as CalendarEventType)) as CalendarEventType[])
    : [];

  // Sync URL when filters change
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

  // Refetch when filters change
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
      {/* Expiring banner */}
      <ExpiringBanner
        count={expiringCount}
        days={expiringDays}
        href={expiringHref}
      />

      {/* Filters */}
      <CalendarFilters
        properties={properties}
        selectedProperty={selectedProperty}
        onPropertyChange={(id) => updateQuery({ property: id })}
        selectedTypes={selectedTypes}
        onTypesChange={(t) => updateQuery({ types: t })}
      />

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
              onClick={() => {
                setView("month");
                updateQuery({ view: "month" });
              }}
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
              onClick={() => {
                setView("list");
                updateQuery({ view: "list" });
              }}
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
// 6. Update pages — pass properties + expiring count
// =============================================================================
FILES["src/app/(dashboard)/accounting/calendar/page.tsx"] =
`import { requirePagePermission } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import {
  getCalendarMonth,
  summarizeMonth,
  getExpiringSoon,
} from "@/lib/calendar/aggregate";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { CalendarShell } from "@/components/calendar/calendar-shell";
import { formatPHP } from "@/lib/utils/format-php";

export default async function AccountingCalendarPage() {
  await requirePagePermission("invoice:read");
  const supabase = await createClient();

  const now = new Date();

  const [month, properties, expiring] = await Promise.all([
    getCalendarMonth(now.getFullYear(), now.getMonth() + 1, { types: [] }),
    supabase.from("property").select("id, name").is("archived_at", null).order("name"),
    getExpiringSoon(30, null),
  ]);

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

      <CalendarShell
        initial={month}
        properties={properties.data ?? []}
        expiringCount={expiring.length}
        expiringDays={30}
        expiringHref="/property/leases"
      />
    </div>
  );
}
`;

FILES["src/app/(dashboard)/property/calendar/page.tsx"] =
`import { requirePagePermission } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import {
  getCalendarMonth,
  summarizeMonth,
  getExpiringSoon,
} from "@/lib/calendar/aggregate";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { CalendarShell } from "@/components/calendar/calendar-shell";
import { formatPHP } from "@/lib/utils/format-php";

export default async function PropertyCalendarPage() {
  await requirePagePermission("lease:read");
  const supabase = await createClient();

  const now = new Date();

  const [month, properties, expiring] = await Promise.all([
    getCalendarMonth(now.getFullYear(), now.getMonth() + 1, { types: [] }),
    supabase.from("property").select("id, name").is("archived_at", null).order("name"),
    getExpiringSoon(30, null),
  ]);

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

      <CalendarShell
        initial={month}
        properties={properties.data ?? []}
        expiringCount={expiring.length}
        expiringDays={30}
        expiringHref="/property/leases"
      />
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

  console.log("Tenant Payment Calendar — Pass 2 (Filters)\n");

  let count = 0;
  for (const [relPath, content] of Object.entries(FILES)) {
    const full = join(ROOT, relPath);
    const exists_ = await exists(full);
    console.log((exists_ ? "  ~ " : "  + ") + relPath);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, content, "utf8");
    count++;
  }

  console.log("\nDone — " + count + " file(s) written.\n");
  console.log("Next:");
  console.log("  npm run typecheck");
  console.log("  npm run dev");
  console.log("  Visit /accounting/calendar or /property/calendar");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});