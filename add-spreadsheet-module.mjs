#!/usr/bin/env node
/**
 * add-spreadsheet-module.mjs
 * Accounting spreadsheet: one tab per property, one row per active lease,
 * with inline-editable rent/deposit/dates and computed invoice/payment columns.
 *
 * Usage: node add-spreadsheet-module.mjs [--dry]
 */
import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import { join, dirname } from "node:path";

const DRY = process.argv.includes("--dry");
const ROOT = process.cwd();

async function exists(p) {
  try { await access(p, constants.F_OK); return true; } catch { return false; }
}

async function writeFileSafe(rel, content) {
  const full = join(ROOT, rel);
  if (DRY) { console.log("  ~ would write: " + rel); return; }
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, content, "utf8");
  console.log("  + wrote: " + rel);
}

async function patchFile(rel, mutate) {
  const full = join(ROOT, rel);
  if (!(await exists(full))) { console.log("  ! missing: " + rel); return; }
  const before = await readFile(full, "utf8");
  const after = mutate(before);
  if (after === before) { console.log("  = no change: " + rel); return; }
  if (DRY) { console.log("  ~ would patch: " + rel); return; }
  await writeFile(full, after, "utf8");
  console.log("  + patched: " + rel);
}

// ===========================================================================
// 1. src/lib/db/spreadsheet.ts
// ===========================================================================

const DB = `import "server-only";
import { createClient } from "@/lib/supabase/server";

export type SpreadsheetRow = {
  lease_id: string;
  unit_id: string;
  unit_number: string | null;
  tenant_id: string;
  tenant_name: string | null;
  tenant_phone: string | null;
  lease_status: string;
  start_date: string;
  end_date: string;
  monthly_rent: number;
  deposit_1: number;
  deposit_2: number;
  // computed
  invoiced_month: number;
  paid_month: number;
  balance: number;
  last_payment_date: string | null;
  overdue: number;
  utility_balance: number;
};

export type SpreadsheetResult = {
  rows: SpreadsheetRow[];
  totals: {
    monthly_rent: number;
    deposit_1: number;
    deposit_2: number;
    invoiced_month: number;
    paid_month: number;
    balance: number;
    overdue: number;
    utility_balance: number;
  };
};

/**
 * Fetch the spreadsheet for one property and month.
 * month format: "YYYY-MM"
 */
export async function getSpreadsheetRows(
  property_id: string,
  month: string
): Promise<SpreadsheetResult> {
  const supabase = await createClient();

  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const mo = Number(monthStr);
  const monthStart = new Date(Date.UTC(year, mo - 1, 1)).toISOString().slice(0, 10);
  const monthEnd = new Date(Date.UTC(year, mo, 0)).toISOString().slice(0, 10);

  // 1. Units in this property
  const { data: units } = await supabase
    .from("unit")
    .select("id, unit_number")
    .eq("property_id", property_id)
    .order("unit_number");
  const unitRows = (units ?? []) as { id: string; unit_number: string }[];
  const unitIds = unitRows.map((u) => u.id);
  const unitMap = new Map(unitRows.map((u) => [u.id, u.unit_number]));

  if (unitIds.length === 0) {
    return { rows: [], totals: emptyTotals() };
  }

  // 2. Active leases on those units
  const { data: leases } = await supabase
    .from("lease")
    .select(
      "id, unit_id, tenant_id, start_date, end_date, monthly_rent, deposit_1, deposit_2, status"
    )
    .in("unit_id", unitIds)
    .eq("status", "active");

  const leaseRows = (leases ?? []) as {
    id: string;
    unit_id: string;
    tenant_id: string;
    start_date: string;
    end_date: string;
    monthly_rent: number;
    deposit_1: number | null;
    deposit_2: number | null;
    status: string;
  }[];

  if (leaseRows.length === 0) {
    return { rows: [], totals: emptyTotals() };
  }

  const leaseIds = leaseRows.map((l) => l.id);
  const tenantIds = Array.from(new Set(leaseRows.map((l) => l.tenant_id)));

  // 3. Tenants
  const { data: tenants } = await supabase
    .from("tenant")
    .select("id, full_name, phone")
    .in("id", tenantIds);
  const tenantMap = new Map(
    ((tenants ?? []) as { id: string; full_name: string | null; phone: string | null }[]).map(
      (t) => [t.id, t]
    )
  );

  // 4. Invoices for those leases
  const { data: invoices } = await supabase
    .schema("acct")
    .from("invoice")
    .select("id, lease_id, type, amount, due_date, status")
    .in("lease_id", leaseIds);

  const invoiceRows = (invoices ?? []) as {
    id: string;
    lease_id: string;
    type: string;
    amount: number;
    due_date: string;
    status: string;
  }[];

  const invoiceIds = invoiceRows.map((i) => i.id);
  const invoiceToLease = new Map(invoiceRows.map((i) => [i.id, i.lease_id]));

  // 5. Payments on those invoices
  let paymentRows: { id: string; invoice_id: string; amount: number; paid_at: string }[] = [];
  if (invoiceIds.length > 0) {
    const { data: payments } = await supabase
      .schema("acct")
      .from("payment")
      .select("id, invoice_id, amount, paid_at")
      .in("invoice_id", invoiceIds);
    paymentRows = (payments ?? []) as typeof paymentRows;
  }

  // ---- aggregate per lease ----
  const UTILITY_TYPES = new Set(["utility", "electricity", "water", "gas"]);

  const perLease = new Map<
    string,
    {
      invoiced_month: number;
      paid_month: number;
      balance: number;
      overdue: number;
      utility_balance: number;
      last_payment_date: string | null;
    }
  >();

  for (const l of leaseRows) {
    perLease.set(l.id, {
      invoiced_month: 0,
      paid_month: 0,
      balance: 0,
      overdue: 0,
      utility_balance: 0,
      last_payment_date: null,
    });
  }

  // Invoiced this month + balance + overdue + utility_balance
  for (const inv of invoiceRows) {
    const agg = perLease.get(inv.lease_id);
    if (!agg) continue;
    const due = inv.due_date.slice(0, 10);
    const amt = Number(inv.amount ?? 0);

    if (due >= monthStart && due <= monthEnd) {
      agg.invoiced_month += amt;
    }
    if (inv.status === "unpaid" || inv.status === "overdue") {
      agg.balance += amt;
    }
    if (inv.status === "overdue") {
      agg.overdue += amt;
    }
    if (
      (inv.status === "unpaid" || inv.status === "overdue") &&
      UTILITY_TYPES.has(inv.type)
    ) {
      agg.utility_balance += amt;
    }
  }

  // Paid this month + last payment
  for (const p of paymentRows) {
    const leaseId = invoiceToLease.get(p.invoice_id);
    if (!leaseId) continue;
    const agg = perLease.get(leaseId);
    if (!agg) continue;
    const paidDay = (p.paid_at ?? "").slice(0, 10);
    const amt = Number(p.amount ?? 0);

    if (paidDay >= monthStart && paidDay <= monthEnd) {
      agg.paid_month += amt;
    }
    if (!agg.last_payment_date || paidDay > agg.last_payment_date) {
      agg.last_payment_date = paidDay || null;
    }
  }

  // ---- build rows ----
  const rows: SpreadsheetRow[] = leaseRows.map((l) => {
    const t = tenantMap.get(l.tenant_id);
    const agg = perLease.get(l.id)!;
    return {
      lease_id: l.id,
      unit_id: l.unit_id,
      unit_number: unitMap.get(l.unit_id) ?? null,
      tenant_id: l.tenant_id,
      tenant_name: t?.full_name ?? null,
      tenant_phone: t?.phone ?? null,
      lease_status: l.status,
      start_date: l.start_date,
      end_date: l.end_date,
      monthly_rent: Number(l.monthly_rent ?? 0),
      deposit_1: Number(l.deposit_1 ?? 0),
      deposit_2: Number(l.deposit_2 ?? 0),
      invoiced_month: agg.invoiced_month,
      paid_month: agg.paid_month,
      balance: agg.balance,
      last_payment_date: agg.last_payment_date,
      overdue: agg.overdue,
      utility_balance: agg.utility_balance,
    };
  });

  rows.sort((a, b) =>
    (a.unit_number ?? "").localeCompare(b.unit_number ?? "", undefined, {
      numeric: true,
    })
  );

  const totals = rows.reduce(
    (acc, r) => ({
      monthly_rent: acc.monthly_rent + r.monthly_rent,
      deposit_1: acc.deposit_1 + r.deposit_1,
      deposit_2: acc.deposit_2 + r.deposit_2,
      invoiced_month: acc.invoiced_month + r.invoiced_month,
      paid_month: acc.paid_month + r.paid_month,
      balance: acc.balance + r.balance,
      overdue: acc.overdue + r.overdue,
      utility_balance: acc.utility_balance + r.utility_balance,
    }),
    emptyTotals()
  );

  return { rows, totals };
}

function emptyTotals() {
  return {
    monthly_rent: 0,
    deposit_1: 0,
    deposit_2: 0,
    invoiced_month: 0,
    paid_month: 0,
    balance: 0,
    overdue: 0,
    utility_balance: 0,
  };
}
`;

await writeFileSafe("src/lib/db/spreadsheet.ts", DB);

// ===========================================================================
// 2. Server action: update one cell
// ===========================================================================

const ACTIONS = `"use server";

import { revalidatePath } from "next/cache";
import { assertPermission } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/admin";

type ActionResult = { ok: true } | { ok: false; error: string };

export type EditableField =
  | "monthly_rent"
  | "deposit_1"
  | "deposit_2"
  | "start_date"
  | "end_date";

export async function updateLeaseCellAction(
  lease_id: string,
  field: EditableField,
  rawValue: string
): Promise<ActionResult> {
  try {
    await assertPermission("lease:update");
  } catch {
    return { ok: false, error: "Forbidden: missing lease:update" };
  }

  if (!lease_id) return { ok: false, error: "Missing lease id" };

  const patch: Record<string, unknown> = {};

  if (field === "monthly_rent" || field === "deposit_1" || field === "deposit_2") {
    const n = Number(rawValue.replace(/[₱,\\s]/g, ""));
    if (!Number.isFinite(n) || n < 0) {
      return { ok: false, error: "Must be a non-negative number" };
    }
    patch[field] = n;
  } else if (field === "start_date" || field === "end_date") {
    // Accept YYYY-MM-DD directly, or validate anything parseable.
    const s = rawValue.trim();
    if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(s)) {
      return { ok: false, error: "Date must be YYYY-MM-DD" };
    }
    patch[field] = s;
  } else {
    return { ok: false, error: "Field not editable" };
  }

  // If updating a date, verify end_date >= start_date after the change.
  const admin = createAdminClient();

  if (field === "start_date" || field === "end_date") {
    const { data: current } = await admin
      .schema("core")
      .from("lease")
      .select("start_date, end_date")
      .eq("id", lease_id)
      .maybeSingle();

    if (!current) return { ok: false, error: "Lease not found" };

    const start = field === "start_date" ? String(patch[field]) : String((current as any).start_date);
    const end = field === "end_date" ? String(patch[field]) : String((current as any).end_date);

    if (new Date(end).getTime() < new Date(start).getTime()) {
      return { ok: false, error: "End date must be on or after start date" };
    }
  }

  const { error } = await admin
    .schema("core")
    .from("lease")
    .update(patch)
    .eq("id", lease_id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/accounting/spreadsheet");
  return { ok: true };
}
`;

await writeFileSafe("src/app/(dashboard)/accounting/spreadsheet/actions.ts", ACTIONS);

// ===========================================================================
// 3. CSV export route
// ===========================================================================

const EXPORT = `import { NextResponse } from "next/server";
import { requirePagePermission } from "@/lib/auth/guard";
import { getSpreadsheetRows } from "@/lib/db/spreadsheet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\\n\\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export async function GET(req: Request) {
  await requirePagePermission("report:read");

  const url = new URL(req.url);
  const property_id = url.searchParams.get("property");
  const month = url.searchParams.get("month") ?? new Date().toISOString().slice(0, 7);

  if (!property_id) {
    return NextResponse.json({ error: "missing property" }, { status: 400 });
  }

  const { rows } = await getSpreadsheetRows(property_id, month);

  const header = [
    "Unit",
    "Tenant",
    "Phone",
    "Status",
    "Start",
    "End",
    "Monthly rent",
    "Deposit 1",
    "Deposit 2",
    "Invoiced (" + month + ")",
    "Paid (" + month + ")",
    "Balance",
    "Last payment",
    "Overdue",
    "Utility balance",
  ];

  const body = [header.join(",")];
  for (const r of rows) {
    body.push(
      [
        cell(r.unit_number),
        cell(r.tenant_name),
        cell(r.tenant_phone),
        cell(r.lease_status),
        cell(r.start_date),
        cell(r.end_date),
        cell(r.monthly_rent),
        cell(r.deposit_1),
        cell(r.deposit_2),
        cell(r.invoiced_month),
        cell(r.paid_month),
        cell(r.balance),
        cell(r.last_payment_date),
        cell(r.overdue),
        cell(r.utility_balance),
      ].join(",")
    );
  }

  const csv = body.join("\\n");
  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition":
        'attachment; filename="spreadsheet-' + month + "-" + stamp + '.csv"',
      "Cache-Control": "no-store",
    },
  });
}
`;

await writeFileSafe(
  "src/app/(dashboard)/accounting/spreadsheet/export/route.ts",
  EXPORT
);

// ===========================================================================
// 4. Tabs component
// ===========================================================================

const TABS = `"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils/cn";

export function SpreadsheetTabs({
  properties,
}: {
  properties: { id: string; name: string }[];
}) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const active = sp.get("property") ?? properties[0]?.id ?? "";
  const month = sp.get("month") ?? "";

  function hrefFor(id: string) {
    const params = new URLSearchParams(sp.toString());
    params.set("property", id);
    if (month) params.set("month", month);
    return pathname + "?" + params.toString();
  }

  return (
    <div className="flex flex-wrap gap-1.5 border-b border-white/40 pb-2 dark:border-white/[0.06]">
      {properties.map((p) => {
        const isActive = p.id === active;
        return (
          <Link
            key={p.id}
            href={hrefFor(p.id)}
            scroll={false}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-all",
              isActive
                ? "bg-brand-gradient text-white shadow-sm shadow-brand-500/30"
                : "text-ink-600 hover:bg-white/60 dark:hover:bg-white/[0.06]"
            )}
          >
            {p.name}
          </Link>
        );
      })}
    </div>
  );
}
`;

await writeFileSafe(
  "src/components/accounting/spreadsheet-tabs.tsx",
  TABS
);

// ===========================================================================
// 5. Toolbar: month picker + export
// ===========================================================================

const TOOLBAR = `"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SpreadsheetToolbar({ property_id }: { property_id: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const month = sp.get("month") ?? new Date().toISOString().slice(0, 7);

  function onMonthChange(v: string) {
    const params = new URLSearchParams(sp.toString());
    if (v) params.set("month", v);
    else params.delete("month");
    router.replace(pathname + "?" + params.toString(), { scroll: false });
  }

  const exportHref =
    "/accounting/spreadsheet/export?property=" +
    encodeURIComponent(property_id) +
    "&month=" +
    encodeURIComponent(month);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="text-xs font-semibold text-ink-500">Month</label>
      <input
        type="month"
        value={month}
        onChange={(e) => onMonthChange(e.target.value)}
        className="rounded-lg border border-white/60 bg-white/70 px-3 py-1.5 text-sm dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-ink-100"
      />
      <a href={exportHref} download>
        <Button variant="secondary" size="sm">
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Export CSV
        </Button>
      </a>
    </div>
  );
}
`;

await writeFileSafe(
  "src/components/accounting/spreadsheet-toolbar.tsx",
  TOOLBAR
);

// ===========================================================================
// 6. Grid component (the big one — inline editing, tab/enter nav)
// ===========================================================================

const GRID = `"use client";

import { useState, useTransition, useCallback, useRef, useEffect } from "react";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/components/ui/toast";
import { updateLeaseCellAction, type EditableField } from "@/app/(dashboard)/accounting/spreadsheet/actions";
import type { SpreadsheetRow, SpreadsheetResult } from "@/lib/db/spreadsheet";

const EDITABLE = new Set<EditableField>([
  "monthly_rent",
  "deposit_1",
  "deposit_2",
  "start_date",
  "end_date",
]);

type ColumnKey = keyof SpreadsheetRow;

type ColumnDef = {
  key: ColumnKey;
  label: string;
  width: number;
  align?: "right";
  editable?: boolean;
  format: (v: unknown, row: SpreadsheetRow) => string;
  parse?: (s: string) => string;
};

function php(n: number): string {
  return "\\u20b1" + Number(n ?? 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function shortDate(iso: string | null): string {
  if (!iso) return "\\u2014";
  const d = new Date(iso);
  return d.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "2-digit",
  });
}

const COLUMNS: ColumnDef[] = [
  { key: "unit_number", label: "Unit", width: 90, format: (v) => (v ? String(v) : "\\u2014") },
  { key: "tenant_name", label: "Tenant", width: 200, format: (v) => (v ? String(v) : "\\u2014") },
  { key: "lease_status", label: "Status", width: 90, format: (v) => String(v ?? "") },
  { key: "start_date", label: "Start", width: 110, editable: true, format: (v) => shortDate(v as string) },
  { key: "end_date", label: "End", width: 110, editable: true, format: (v) => shortDate(v as string) },
  { key: "monthly_rent", label: "Monthly rent", width: 120, align: "right", editable: true, format: (v) => php(Number(v ?? 0)) },
  { key: "deposit_1", label: "Deposit 1", width: 110, align: "right", editable: true, format: (v) => php(Number(v ?? 0)) },
  { key: "deposit_2", label: "Deposit 2", width: 110, align: "right", editable: true, format: (v) => php(Number(v ?? 0)) },
  { key: "invoiced_month", label: "Invoiced", width: 120, align: "right", format: (v) => php(Number(v ?? 0)) },
  { key: "paid_month", label: "Paid", width: 120, align: "right", format: (v) => php(Number(v ?? 0)) },
  { key: "balance", label: "Balance", width: 120, align: "right", format: (v) => php(Number(v ?? 0)) },
  { key: "last_payment_date", label: "Last payment", width: 130, format: (v) => shortDate(v as string | null) },
  { key: "overdue", label: "Overdue", width: 120, align: "right", format: (v) => php(Number(v ?? 0)) },
  { key: "utility_balance", label: "Utility bal.", width: 130, align: "right", format: (v) => php(Number(v ?? 0)) },
];

const TOTALS_LABELS: Partial<Record<ColumnKey, string>> = {
  monthly_rent: "Monthly rent",
  deposit_1: "Deposit 1",
  deposit_2: "Deposit 2",
  invoiced_month: "Invoiced",
  paid_month: "Paid",
  balance: "Balance",
  overdue: "Overdue",
  utility_balance: "Utility bal.",
};

export function SpreadsheetGrid({
  initial,
  property_id,
}: {
  initial: SpreadsheetResult;
  property_id: string;
}) {
  const [rows, setRows] = useState<SpreadsheetRow[]>(initial.rows);
  const [totals, setTotals] = useState(initial.totals);
  const [editing, setEditing] = useState<{ leaseId: string; field: EditableField } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [pending, start] = useTransition();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset when the server sends fresh data (e.g., after a month/tab change).
  useEffect(() => {
    setRows(initial.rows);
    setTotals(initial.totals);
  }, [initial]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const recomputeTotals = useCallback((rs: SpreadsheetRow[]) => {
    return rs.reduce(
      (acc, r) => ({
        monthly_rent: acc.monthly_rent + r.monthly_rent,
        deposit_1: acc.deposit_1 + r.deposit_1,
        deposit_2: acc.deposit_2 + r.deposit_2,
        invoiced_month: acc.invoiced_month + r.invoiced_month,
        paid_month: acc.paid_month + r.paid_month,
        balance: acc.balance + r.balance,
        overdue: acc.overdue + r.overdue,
        utility_balance: acc.utility_balance + r.utility_balance,
      }),
      {
        monthly_rent: 0,
        deposit_1: 0,
        deposit_2: 0,
        invoiced_month: 0,
        paid_month: 0,
        balance: 0,
        overdue: 0,
        utility_balance: 0,
      }
    );
  }, []);

  function beginEdit(leaseId: string, field: EditableField, currentValue: number | string) {
    setEditing({ leaseId, field });
    setEditValue(String(currentValue ?? ""));
  }

  function commit(leaseId: string, field: EditableField, raw: string) {
    const row = rows.find((r) => r.lease_id === leaseId);
    if (!row) {
      setEditing(null);
      return;
    }

    // Optimistic update
    const prevValue = row[field as keyof SpreadsheetRow];
    let parsed: number | string = raw;
    if (field === "monthly_rent" || field === "deposit_1" || field === "deposit_2") {
      parsed = Number(raw.replace(/[₱,\\s]/g, "")) || 0;
    }

    const nextRows = rows.map((r) =>
      r.lease_id === leaseId ? { ...r, [field]: parsed } : r
    );
    setRows(nextRows);
    setTotals(recomputeTotals(nextRows));
    setEditing(null);

    start(async () => {
      const res = await updateLeaseCellAction(leaseId, field, raw);
      if (!res.ok) {
        // Roll back
        const rolled = rows.map((r) =>
          r.lease_id === leaseId ? { ...r, [field]: prevValue } : r
        );
        setRows(rolled);
        setTotals(recomputeTotals(rolled));
        toast.push(res.error, "error");
      } else {
        toast.push("Saved", "success");
      }
    });
  }

  function cancel() {
    setEditing(null);
  }

  function onKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>,
    leaseId: string,
    field: EditableField
  ) {
    if (e.key === "Enter") {
      e.preventDefault();
      commit(leaseId, field, editValue);
      // Move down to same column in next row
      const idx = rows.findIndex((r) => r.lease_id === leaseId);
      const next = rows[idx + 1];
      if (next) beginEdit(next.lease_id, field, next[field as keyof SpreadsheetRow] as number | string);
    } else if (e.key === "Tab") {
      e.preventDefault();
      commit(leaseId, field, editValue);
      // Move right (or left with Shift) to next editable column in same row
      const editableKeys = COLUMNS.filter((c) => c.editable).map((c) => c.key) as EditableField[];
      const ci = editableKeys.indexOf(field);
      const dir = e.shiftKey ? -1 : 1;
      const target = editableKeys[ci + dir];
      if (target) {
        const idx = rows.findIndex((r) => r.lease_id === leaseId);
        const r = rows[idx];
        setTimeout(() => beginEdit(leaseId, target, r[target as keyof SpreadsheetRow] as number | string), 0);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-white/40 bg-white/40 py-16 text-center text-sm text-ink-500 dark:border-white/[0.06] dark:bg-white/[0.02]">
        No active leases in this property.
      </div>
    );
  }

  return (
    <div className="overflow-auto rounded-2xl border border-white/40 bg-white/40 backdrop-blur-sm dark:border-white/[0.06] dark:bg-white/[0.02]">
      <table className="min-w-full text-sm">
        <thead className="sticky top-0 z-10 bg-surface-raised/95 backdrop-blur-sm">
          <tr className="border-b border-white/40 text-left text-xs uppercase tracking-wide text-ink-500 dark:border-white/[0.06]">
            {COLUMNS.map((c, i) => (
              <th
                key={c.key}
                style={{
                  minWidth: c.width,
                  position: i < 2 ? "sticky" : undefined,
                  left: i === 0 ? 0 : i === 1 ? 90 : undefined,
                  zIndex: i < 2 ? 11 : 1,
                  background: i < 2 ? "rgb(var(--surface-raised))" : undefined,
                }}
                className={cn(
                  "px-3 py-2 font-semibold",
                  c.align === "right" && "text-right"
                )}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.lease_id}
              className="border-b border-white/30 hover:bg-white/30 dark:border-white/[0.04] dark:hover:bg-white/[0.03]"
            >
              {COLUMNS.map((c, i) => {
                const value = r[c.key];
                const isEditing =
                  editing?.leaseId === r.lease_id && editing.field === (c.key as EditableField);

                return (
                  <td
                    key={c.key}
                    style={{
                      position: i < 2 ? "sticky" : undefined,
                      left: i === 0 ? 0 : i === 1 ? 90 : undefined,
                      zIndex: i < 2 ? 2 : 1,
                      background:
                        i < 2
                          ? "rgb(var(--surface-raised) / 0.94)"
                          : undefined,
                    }}
                    className={cn(
                      "px-3 py-2 tabular-nums",
                      c.align === "right" && "text-right",
                      c.editable && !isEditing && "cursor-pointer hover:bg-brand-500/5"
                    )}
                    onClick={() => {
                      if (c.editable && !isEditing) {
                        beginEdit(
                          r.lease_id,
                          c.key as EditableField,
                          value as number | string
                        );
                      }
                    }}
                  >
                    {isEditing ? (
                      <input
                        ref={inputRef}
                        type={c.key === "start_date" || c.key === "end_date" ? "date" : "text"}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => commit(r.lease_id, c.key as EditableField, editValue)}
                        onKeyDown={(e) =>
                          onKeyDown(e, r.lease_id, c.key as EditableField)
                        }
                        className="w-full rounded border border-brand-400 bg-white px-1.5 py-0.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-ink-900"
                      />
                    ) : (
                      c.format(value, r)
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        <tfoot className="sticky bottom-0 bg-surface-raised/95 backdrop-blur-sm">
          <tr className="border-t border-white/40 text-sm font-semibold dark:border-white/[0.06]">
            {COLUMNS.map((c, i) => {
              const label = TOTALS_LABELS[c.key];
              const total = label ? (totals as Record<string, number>)[c.key] : undefined;
              return (
                <td
                  key={c.key}
                  style={{
                    position: i < 2 ? "sticky" : undefined,
                    left: i === 0 ? 0 : i === 1 ? 90 : undefined,
                    zIndex: i < 2 ? 2 : 1,
                    background: i < 2 ? "rgb(var(--surface-raised) / 0.94)" : undefined,
                  }}
                  className={cn("px-3 py-2", c.align === "right" && "text-right tabular-nums")}
                >
                  {i === 0 ? "TOTAL" : total !== undefined ? php(total) : ""}
                </td>
              );
            })}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
`;

await writeFileSafe(
  "src/components/accounting/spreadsheet-grid.tsx",
  GRID
);

// ===========================================================================
// 7. Page
// ===========================================================================

const PAGE = `import { requirePagePermission } from "@/lib/auth/guard";
import { listProperties } from "@/lib/db/properties";
import { getSpreadsheetRows } from "@/lib/db/spreadsheet";
import { PageHeader } from "@/components/layout/page-header";
import { SpreadsheetTabs } from "@/components/accounting/spreadsheet-tabs";
import { SpreadsheetToolbar } from "@/components/accounting/spreadsheet-toolbar";
import { SpreadsheetGrid } from "@/components/accounting/spreadsheet-grid";

export default async function SpreadsheetPage({
  searchParams,
}: {
  searchParams: Promise<{ property?: string; month?: string }>;
}) {
  await requirePagePermission("report:read");
  const sp = await searchParams;

  const properties = await listProperties();
  if (properties.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Spreadsheet" description="No properties configured." />
      </div>
    );
  }

  const property_id = sp.property ?? properties[0].id;
  const month = sp.month ?? new Date().toISOString().slice(0, 7);

  const result = await getSpreadsheetRows(property_id, month);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Spreadsheet"
        description="Per-property detail of every active lease, invoice, and payment."
        action={<SpreadsheetToolbar property_id={property_id} />}
      />

      <SpreadsheetTabs
        properties={properties.map((p) => ({ id: p.id, name: p.name }))}
      />

      <SpreadsheetGrid initial={result} property_id={property_id} />
    </div>
  );
}
`;

await writeFileSafe(
  "src/app/(dashboard)/accounting/spreadsheet/page.tsx",
  PAGE
);

// ===========================================================================
// 8. Sidebar entry
// ===========================================================================

await patchFile("src/components/shell/sidebar.tsx", (src) => {
  if (src.includes('href: "/accounting/spreadsheet"')) return src;
  return src.replace(
    /(\{ href: "\/accounting\/approvals",[^}]+\},)/,
    '$1\n      { href: "/accounting/spreadsheet", label: "Spreadsheet", icon: BarChart3, roles: ["accounting", "executive"] },'
  );
});

console.log("");
console.log("Done. Next:");
console.log("  1. npm run typecheck");
console.log("  2. npm run build     (this catches the same errors Vercel catches)");
console.log("  3. npm run dev");
console.log("  4. Open /accounting/spreadsheet");
console.log("");