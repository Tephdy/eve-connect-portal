import "server-only";
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

  console.log("[calendar] window:", startStr, "->", endStr);
  console.log("[calendar] property filter:", filters.property_id ?? "(none)");
  console.log("[calendar] types filter:", filters.types.length > 0 ? filters.types.join(",") : "(all)");

  // ---- Leases ----
  const { data: leaseRows, error: leaseErr } = await supabase
    .from("lease")
    .select(
      "id, unit_id, tenant_id, start_date, end_date, due_date, monthly_rent, status, unit_number, tenant_name"
    );

  if (leaseErr) {
  console.error("[calendar] lease query FAILED");
  console.error("[calendar] message:", leaseErr.message);
  console.error("[calendar] code:", leaseErr.code);
  console.error("[calendar] details:", leaseErr.details);
  console.error("[calendar] hint:", leaseErr.hint);
}

  const leases = (leaseRows ?? []) as any[];

  console.log("[calendar] total leases loaded:", leases.length);
  console.log(
    "[calendar] lease end_dates:",
    leases.map((l) => ({
      id: String(l.id).slice(0, 8),
      end: l.end_date,
      start: l.start_date,
      status: l.status,
      has_end: l.end_date != null,
    }))
  );

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

  console.log("[calendar] filteredLeases count:", filteredLeases.length);

  // ---- Invoices ----
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

  // ---- Payments ----
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

  // ---- lease_ending ----
  console.log("[calendar] shouldInclude(lease_ending):", shouldInclude("lease_ending"));
  if (shouldInclude("lease_ending")) {
    for (const l of filteredLeases) {
      const inRange = l.end_date >= startStr && l.end_date <= endStr;
      const validStatus = l.status === "active" || l.status === "expiring";

      console.log("[calendar] lease_ending check:", {
        id: String(l.id).slice(0, 8),
        end_date: l.end_date,
        in_window: inRange,
        status: l.status,
        valid_status: validStatus,
        will_push: inRange && validStatus,
      });

      if (!inRange) continue;
      if (!validStatus) continue;
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

  console.log("[calendar] final event count:", Object.values(eventsByDate).flat().length);
  console.log(
    "[calendar] final by type:",
    Object.values(eventsByDate)
      .flat()
      .reduce((acc: Record<string, number>, e) => {
        acc[e.type] = (acc[e.type] ?? 0) + 1;
        return acc;
      }, {})
  );

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