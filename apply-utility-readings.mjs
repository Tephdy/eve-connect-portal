// apply-utility-readings.mjs
// Idempotent scaffold for the per-property bulk meter readings grid.
// Usage: node apply-utility-readings.mjs
// Safe to re-run: skips files/functions that already exist.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const NL = "\n"; // new files: LF is fine on both platforms

const NEW_FILES = [
  // ---------------------------------------------------------------------
  {
    path: "supabase/migrations/20260927120000_meter_reading_billing_fields.sql",
    content: `-- Adds billing fields to acct.meter_reading for the per-property bulk readings grid.
-- Idempotent. Safe to re-run.

alter table acct.meter_reading
  add column if not exists rate_snapshot  numeric,
  add column if not exists amount_due     numeric,
  add column if not exists penalty_amount numeric not null default 0,
  add column if not exists total_due      numeric,
  add column if not exists or_number      text,
  add column if not exists invoice_id     uuid;

create index if not exists meter_reading_or_idx
  on acct.meter_reading (or_number) where or_number is not null;

create index if not exists meter_reading_invoice_idx
  on acct.meter_reading (invoice_id) where invoice_id is not null;

notify pgrst, 'reload schema';
`,
  },

  // ---------------------------------------------------------------------
  {
    path: "src/app/(dashboard)/property/utilities/readings/page.tsx",
    content: `import { requirePagePermission } from "@/lib/auth/guard";
import { listProperties } from "@/lib/db/properties";
import { listBillingRowsForProperty } from "@/lib/db/utilities";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Card, CardBody } from "@/components/ui/card";
import { ReadingsGrid } from "@/components/utilities/readings-grid";
import { UtilityTypeTabs } from "@/components/utilities/utility-type-tabs";
import { PropertyPicker } from "@/components/utilities/property-picker";

export default async function ReadingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    property?: string;
    type?: string;
    date?: string;
  }>;
}) {
  await requirePagePermission("utility:read");
  const sp = await searchParams;
  const properties = await listProperties();

  if (properties.length === 0) {
    return (
      <EmptyState title="No properties" description="Create a property first." />
    );
  }

  const propertyId = sp.property ?? properties[0].id;
  const utilityType =
    sp.type === "electricity" ? "electricity" : ("water" as const);
  const asOf = sp.date ?? new Date().toISOString().slice(0, 10);

  const { rows, rate, rate_warning } = await listBillingRowsForProperty(
    propertyId,
    utilityType,
    asOf
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meter readings"
        description="Record current readings, compute consumption, and issue invoices."
      />

      <div className="flex flex-wrap items-center gap-3">
        <PropertyPicker
          properties={properties.map((p) => ({ id: p.id, name: p.name }))}
          value={propertyId}
        />
        <UtilityTypeTabs value={utilityType} />
      </div>

      <Card className="overflow-hidden">
        <CardBody className="p-0">
          <ReadingsGrid
            propertyId={propertyId}
            utilityType={utilityType}
            asOfDate={asOf}
            ratePerUnit={rate}
            rateWarning={rate_warning}
            rows={rows}
          />
        </CardBody>
      </Card>
    </div>
  );
}
`,
  },

  // ---------------------------------------------------------------------
  {
    path: "src/app/(dashboard)/property/utilities/readings/actions.ts",
    content: `"use server";

import { revalidatePath } from "next/cache";
import { assertPermission } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { saveReadingRow, makeInvoiceFromReading } from "@/lib/db/utilities";

type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function saveReadingRowAction(input: {
  meter_id: string;
  reading: number;
  reading_date: string;
  penalty_amount: number;
  remarks: string | null;
  or_number: string | null;
  rate_snapshot: number;
}): Promise<ActionResult<{ id: string }>> {
  try {
    await assertPermission("utility:record");
  } catch {
    return { ok: false, error: "Forbidden: missing utility:record" };
  }

  if (!Number.isFinite(input.reading) || input.reading < 0)
    return { ok: false, error: "Reading must be a non-negative number" };
  if (!input.reading_date)
    return { ok: false, error: "Reading date is required" };
  if (!Number.isFinite(input.rate_snapshot) || input.rate_snapshot < 0)
    return { ok: false, error: "Rate must be a non-negative number" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  try {
    const saved = await saveReadingRow({
      meter_id: input.meter_id,
      reading: input.reading,
      reading_date: input.reading_date,
      penalty_amount: input.penalty_amount || 0,
      remarks: input.remarks,
      or_number: input.or_number,
      rate_snapshot: input.rate_snapshot,
      recorded_by: user?.id ?? null,
    });
    revalidatePath("/property/utilities/readings");
    revalidatePath("/property/utilities/billing");
    revalidatePath("/property/meters");
    return { ok: true, data: { id: saved.id } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Save failed",
    };
  }
}

export async function makeInvoiceAction(input: {
  reading_id: string;
  due_date: string;
}): Promise<ActionResult<{ invoice_id: string; display_number: string }>> {
  try {
    await assertPermission("utility:bill");
  } catch {
    return { ok: false, error: "Forbidden: missing utility:bill" };
  }
  try {
    const result = await makeInvoiceFromReading(input);
    revalidatePath("/property/utilities/readings");
    revalidatePath("/property/utilities/billing");
    revalidatePath("/accounting/invoices");
    return { ok: true, data: result };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Invoice failed",
    };
  }
}
`,
  },

  // ---------------------------------------------------------------------
  {
    path: "src/components/utilities/utility-type-tabs.tsx",
    content: `"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

export function UtilityTypeTabs({ value }: { value: "water" | "electricity" }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();

  const set = (v: string) => {
    const next = new URLSearchParams(sp.toString());
    next.set("type", v);
    router.push(path + "?" + next.toString());
  };

  return (
    <div className="inline-flex rounded-md border border-line-200 p-0.5">
      {["water", "electricity"].map((t) => (
        <button
          key={t}
          onClick={() => set(t)}
          className={
            "rounded px-3 py-1 text-sm capitalize " +
            (value === t
              ? "bg-brand-600 text-white"
              : "text-ink-600 hover:bg-surface-100")
          }
        >
          {t}
        </button>
      ))}
    </div>
  );
}
`,
  },

  // ---------------------------------------------------------------------
  {
    path: "src/components/utilities/property-picker.tsx",
    content: `"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

export function PropertyPicker({
  properties,
  value,
}: {
  properties: { id: string; name: string }[];
  value: string;
}) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();

  return (
    <select
      value={value}
      onChange={(e) => {
        const next = new URLSearchParams(sp.toString());
        next.set("property", e.target.value);
        router.push(path + "?" + next.toString());
      }}
      className="rounded border border-line-300 px-2 py-1 text-sm"
    >
      {properties.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}
`,
  },

  // ---------------------------------------------------------------------
  {
    path: "src/components/utilities/readings-grid.tsx",
    content: `"use client";

import { useState, useTransition } from "react";
import type { BillingRow, UtilityType } from "@/lib/db/utilities";
import { formatPHP } from "@/lib/utils/format-php";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  saveReadingRowAction,
  makeInvoiceAction,
} from "@/app/(dashboard)/property/utilities/readings/actions";

type RowState = {
  current: string;
  penalty: string;
  remarks: string;
  orNumber: string;
  saving: boolean;
  saved: boolean;
  savedReadingId?: string;
  error: string | null;
  invoiceId: string | null;
  invoiceNumber: string | null;
};

export function ReadingsGrid({
  utilityType,
  asOfDate,
  ratePerUnit,
  rateWarning,
  rows,
}: {
  propertyId: string;
  utilityType: UtilityType;
  asOfDate: string;
  ratePerUnit: number | null;
  rateWarning: string | null;
  rows: BillingRow[];
}) {
  const { toast } = useToast();
  const [, startTransition] = useTransition();
  const [date, setDate] = useState(asOfDate);
  const [state, setState] = useState<Record<string, RowState>>(() =>
    Object.fromEntries(
      rows.map((r) => [
        r.meter_id,
        {
          current: "",
          penalty: r.latest_penalty != null ? String(r.latest_penalty) : "0",
          remarks: r.latest_remarks ?? "",
          orNumber: r.latest_or_number ?? "",
          saving: false,
          saved: false,
          error: null,
          invoiceId: r.latest_invoice_id,
          invoiceNumber: null,
        } as RowState,
      ])
    )
  );

  const update = (meterId: string, patch: Partial<RowState>) =>
    setState((s) => ({ ...s, [meterId]: { ...s[meterId], ...patch } }));

  const computeConsumption = (r: BillingRow, current: string) => {
    const c = Number(current);
    if (!Number.isFinite(c) || current === "") return null;
    return Math.max(0, c - r.previous_reading);
  };

  const computeDue = (consumption: number | null) => {
    if (consumption == null || ratePerUnit == null) return null;
    return consumption * ratePerUnit;
  };

  const handleSave = (r: BillingRow) => {
    const s = state[r.meter_id];
    const current = Number(s.current);
    if (!Number.isFinite(current) || current < 0) {
      update(r.meter_id, { error: "Current reading must be a number" });
      return;
    }
    if (ratePerUnit == null) {
      update(r.meter_id, { error: "No rate configured" });
      return;
    }

    update(r.meter_id, { saving: true, error: null });
    startTransition(async () => {
      const res = await saveReadingRowAction({
        meter_id: r.meter_id,
        reading: current,
        reading_date: date,
        penalty_amount: Number(s.penalty) || 0,
        remarks: s.remarks || null,
        or_number: s.orNumber || null,
        rate_snapshot: ratePerUnit,
      });
      if (!res.ok) {
        update(r.meter_id, { saving: false, error: res.error });
        toast({ title: "Save failed", description: res.error, variant: "error" });
        return;
      }
      update(r.meter_id, {
        saving: false,
        saved: true,
        error: null,
        savedReadingId: res.data.id,
      });
      toast({ title: "Saved", description: r.unit_number + " updated" });
    });
  };

  const handleMakeInvoice = (r: BillingRow) => {
    const s = state[r.meter_id];
    if (!s.saved || !s.savedReadingId) {
      update(r.meter_id, { error: "Save the reading first" });
      return;
    }
    const due = new Date(date);
    due.setDate(due.getDate() + 30);
    const dueStr = due.toISOString().slice(0, 10);

    startTransition(async () => {
      const res = await makeInvoiceAction({
        reading_id: s.savedReadingId!,
        due_date: dueStr,
      });
      if (!res.ok) {
        update(r.meter_id, { error: res.error });
        toast({ title: "Invoice failed", description: res.error, variant: "error" });
        return;
      }
      update(r.meter_id, {
        invoiceId: res.data.invoice_id,
        invoiceNumber: res.data.display_number,
      });
      toast({
        title: "Invoice created",
        description: res.data.display_number,
      });
    });
  };

  if (rows.length === 0) {
    return (
      <div className="p-6 text-sm text-ink-500">
        No active {utilityType} meters for this property.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      {rateWarning && (
        <div className="border-b border-warn-200 bg-warn-50 px-4 py-2 text-xs text-warn-800">
          {rateWarning}
        </div>
      )}

      <div className="flex items-center gap-3 border-b border-line-200 px-4 py-3">
        <label className="text-xs font-medium text-ink-600">
          Reading date
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="ml-2 rounded border border-line-300 px-2 py-1 text-sm"
          />
        </label>
        {ratePerUnit != null && (
          <span className="text-xs text-ink-500">
            Rate: <b>{formatPHP(ratePerUnit)}</b> per{" "}
            {utilityType === "water" ? "cu.m" : "kWh"}
          </span>
        )}
      </div>

      <table className="w-full text-sm">
        <thead className="bg-surface-50 text-xs uppercase tracking-wide text-ink-500">
          <tr>
            <th className="px-3 py-2 text-left">Unit / Name</th>
            <th className="px-3 py-2 text-right">Previous</th>
            <th className="px-3 py-2 text-right">Current</th>
            <th className="px-3 py-2 text-right">Consumption</th>
            <th className="px-3 py-2 text-right">Tenant due</th>
            <th className="px-3 py-2 text-right">w/Penalty</th>
            <th className="px-3 py-2 text-right">Per cubic</th>
            <th className="px-3 py-2 text-left">Remarks</th>
            <th className="px-3 py-2 text-left">OR Number</th>
            <th className="px-3 py-2 text-right">Make invoice</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const s = state[r.meter_id];
            const consumption = computeConsumption(r, s.current);
            const due = computeDue(consumption);
            const penalty = Number(s.penalty) || 0;
            const total = due != null ? due + penalty : null;

            return (
              <tr key={r.meter_id} className="border-t border-line-100">
                <td className="px-3 py-2">
                  <div className="font-medium">{r.unit_number ?? "-"}</div>
                  <div className="text-xs text-ink-500">
                    {r.tenant_name ?? "Vacant"}
                  </div>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {r.previous_reading}
                </td>
                <td className="px-3 py-2 text-right">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={s.current}
                    onChange={(e) =>
                      update(r.meter_id, { current: e.target.value })
                    }
                    className="w-24 text-right tabular-nums"
                  />
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {consumption != null ? consumption.toFixed(2) : "-"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {due != null ? formatPHP(due) : "-"}
                </td>
                <td className="px-3 py-2 text-right">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={s.penalty}
                    onChange={(e) =>
                      update(r.meter_id, { penalty: e.target.value })
                    }
                    className="w-24 text-right tabular-nums"
                  />
                  {total != null && penalty > 0 && (
                    <div className="mt-1 text-xs text-ink-500 tabular-nums">
                      = {formatPHP(total)}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-ink-600">
                  {ratePerUnit != null ? formatPHP(ratePerUnit) : "-"}
                </td>
                <td className="px-3 py-2">
                  <Input
                    value={s.remarks}
                    onChange={(e) =>
                      update(r.meter_id, { remarks: e.target.value })
                    }
                    className="w-40"
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    value={s.orNumber}
                    onChange={(e) =>
                      update(r.meter_id, { orNumber: e.target.value })
                    }
                    className="w-32"
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSave(r)}
                      disabled={s.saving}
                    >
                      {s.saving ? "Saving..." : s.saved ? "Saved" : "Save"}
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => handleMakeInvoice(r)}
                      disabled={!s.saved || !!s.invoiceId}
                    >
                      {s.invoiceId
                        ? "Invoiced"
                        : s.invoiceNumber
                        ? s.invoiceNumber
                        : "Make invoice"}
                    </Button>
                  </div>
                  {s.error && (
                    <div className="mt-1 text-xs text-danger-600">
                      {s.error}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
`,
  },
];

// ---------------------------------------------------------------------
// DAL append block (goes into src/lib/db/utilities.ts)
// ---------------------------------------------------------------------

const DAL_MARKER = "// ---- BULK READINGS GRID (added by apply-utility-readings.mjs) ----";

const DAL_APPEND = `
${DAL_MARKER}

export type BillingRow = {
  meter_id: string;
  unit_id: string;
  unit_number: string | null;
  tenant_name: string | null;
  lease_id: string | null;
  utility_type: UtilityType;
  unit_label: string;
  meter_number: string | null;
  previous_reading: number;
  previous_date: string | null;
  latest_reading_id: string | null;
  latest_reading: number | null;
  latest_reading_date: string | null;
  latest_rate_snapshot: number | null;
  latest_amount_due: number | null;
  latest_penalty: number | null;
  latest_total_due: number | null;
  latest_remarks: string | null;
  latest_or_number: string | null;
  latest_invoice_id: string | null;
};

export async function listBillingRowsForProperty(
  property_id: string,
  utility_type: UtilityType,
  as_of_date: string
): Promise<{ rows: BillingRow[]; rate: number | null; rate_warning: string | null }> {
  const supabase = await createClient();

  const { data: units } = await supabase
    .from("unit")
    .select("id, unit_number")
    .eq("property_id", property_id);

  const unitIds = (units ?? []).map((u: any) => u.id);
  if (unitIds.length === 0) {
    return { rows: [], rate: null, rate_warning: null };
  }

  const unitMap = new Map((units ?? []).map((u: any) => [u.id, u]));

  const { data: meters, error: metersErr } = await supabase
    .schema("acct")
    .from("meter")
    .select("*")
    .in("unit_id", unitIds)
    .eq("utility_type", utility_type)
    .eq("active", true)
    .order("unit_id");
  if (metersErr) throw new Error(metersErr.message);
  const meterRows = (meters ?? []) as Meter[];
  if (meterRows.length === 0) {
    return { rows: [], rate: null, rate_warning: null };
  }

  const meterIds = meterRows.map((m) => m.id);

  const { data: leases } = await supabase
    .from("lease")
    .select("id, unit_id, tenant_id, status")
    .in("unit_id", unitIds)
    .eq("status", "active");
  const leaseByUnit = new Map<string, any>();
  for (const l of leases ?? []) leaseByUnit.set((l as any).unit_id, l);

  const tenantIds = Array.from(
    new Set((leases ?? []).map((l: any) => l.tenant_id).filter(Boolean))
  );
  const { data: tenants } =
    tenantIds.length > 0
      ? await supabase.from("tenant").select("id, full_name").in("id", tenantIds)
      : { data: [] as any[] };
  const tenantMap = new Map((tenants ?? []).map((t: any) => [t.id, t.full_name]));

  const { data: readings } = await supabase.schema("acct")
    .from("meter_reading")
    .select(
      "id, meter_id, reading, reading_date, rate_snapshot, amount_due, penalty_amount, total_due, notes, or_number, invoice_id"
    )
    .in("meter_id", meterIds)
    .lte("reading_date", as_of_date)
    .order("reading_date", { ascending: false });

  const byMeter = new Map<string, any[]>();
  for (const r of readings ?? []) {
    const id = (r as any).meter_id;
    if (!byMeter.has(id)) byMeter.set(id, []);
    byMeter.get(id)!.push(r);
  }

  const { data: rates } = await supabase.schema("acct")
    .from("utility_rate")
    .select("*")
    .or("property_id.eq." + property_id + ",property_id.is.null")
    .eq("utility_type", utility_type);
  const rateRow = findEffectiveRate(
    (rates ?? []) as UtilityRate[],
    property_id,
    utility_type,
    as_of_date
  );

  const rows: BillingRow[] = [];
  for (const m of meterRows) {
    const list = byMeter.get(m.id) ?? [];
    const latest = list[0] ?? null;
    const previous = list[1] ?? null;

    const u: any = unitMap.get(m.unit_id);
    const lease = leaseByUnit.get(m.unit_id);
    const tenant_name = lease ? tenantMap.get(lease.tenant_id) ?? null : null;

    rows.push({
      meter_id: m.id,
      unit_id: m.unit_id,
      unit_number: u?.unit_number ?? null,
      tenant_name,
      lease_id: lease?.id ?? null,
      utility_type: m.utility_type,
      unit_label: m.unit_label,
      meter_number: m.meter_number,
      previous_reading:
        latest != null
          ? Number(latest.reading)
          : Number(m.initial_reading ?? 0),
      previous_date: latest != null ? latest.reading_date : null,
      latest_reading_id: latest?.id ?? null,
      latest_reading: latest ? Number(latest.reading) : null,
      latest_reading_date: latest?.reading_date ?? null,
      latest_rate_snapshot:
        latest?.rate_snapshot != null ? Number(latest.rate_snapshot) : null,
      latest_amount_due:
        latest?.amount_due != null ? Number(latest.amount_due) : null,
      latest_penalty:
        latest?.penalty_amount != null ? Number(latest.penalty_amount) : null,
      latest_total_due:
        latest?.total_due != null ? Number(latest.total_due) : null,
      latest_remarks: latest?.notes ?? null,
      latest_or_number: latest?.or_number ?? null,
      latest_invoice_id: latest?.invoice_id ?? null,
    });
  }

  rows.sort((a, b) =>
    (a.unit_number ?? "").localeCompare(b.unit_number ?? "", undefined, {
      numeric: true,
    })
  );

  return {
    rows,
    rate: rateRow?.rate_per_unit ?? null,
    rate_warning: rateRow
      ? null
      : "No " + utility_type + " rate configured for this property on " + as_of_date + ".",
  };
}

export async function saveReadingRow(input: {
  meter_id: string;
  reading: number;
  reading_date: string;
  penalty_amount: number;
  remarks: string | null;
  or_number: string | null;
  rate_snapshot: number;
  recorded_by: string | null;
}): Promise<MeterReading> {
  const admin = createAdminClient();

  const { data: prevRows } = await admin
    .schema("acct")
    .from("meter_reading")
    .select("reading")
    .eq("meter_id", input.meter_id)
    .lt("reading_date", input.reading_date)
    .order("reading_date", { ascending: false })
    .limit(1);

  const previous =
    prevRows && prevRows.length > 0 ? Number((prevRows[0] as any).reading) : 0;

  const consumption = Math.max(0, input.reading - previous);
  const amount_due = Number((consumption * input.rate_snapshot).toFixed(2));
  const total_due = Number((amount_due + (input.penalty_amount || 0)).toFixed(2));

  const { data, error } = await admin
    .schema("acct")
    .from("meter_reading")
    .upsert(
      {
        meter_id: input.meter_id,
        reading: input.reading,
        reading_date: input.reading_date,
        recorded_by: input.recorded_by,
        notes: input.remarks,
        or_number: input.or_number,
        rate_snapshot: input.rate_snapshot,
        amount_due,
        penalty_amount: input.penalty_amount,
        total_due,
      },
      { onConflict: "meter_id,reading_date" }
    )
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as MeterReading;
}

export async function makeInvoiceFromReading(input: {
  reading_id: string;
  due_date: string;
}): Promise<{ invoice_id: string; display_number: string }> {
  const admin = createAdminClient();

  const { data: reading, error: rErr } = await admin
    .schema("acct")
    .from("meter_reading")
    .select("*")
    .eq("id", input.reading_id)
    .maybeSingle();
  if (rErr) throw new Error(rErr.message);
  if (!reading) throw new Error("Reading not found");
  if ((reading as any).invoice_id)
    throw new Error("Invoice already created for this reading");

  const { data: meter, error: mErr } = await admin
    .schema("acct")
    .from("meter")
    .select("*")
    .eq("id", (reading as any).meter_id)
    .maybeSingle();
  if (mErr) throw new Error(mErr.message);
  if (!meter) throw new Error("Meter not found");

  const unit_id = (meter as any).unit_id;

  const { data: lease } = await admin
    .from("lease")
    .select("id")
    .eq("unit_id", unit_id)
    .eq("status", "active")
    .maybeSingle();
  if (!lease) throw new Error("No active lease for this unit");

  const total = Number((reading as any).total_due ?? 0);
  if (total <= 0) throw new Error("Total due is zero; nothing to invoice");

  const year = new Date(input.due_date).getFullYear();
  const { count } = await admin
    .schema("acct")
    .from("invoice")
    .select("id", { count: "exact", head: true })
    .eq("type", (meter as any).utility_type)
    .gte("created_at", year + "-01-01");
  const display =
    "UTIL-" + year + "-" + String((count ?? 0) + 1).padStart(4, "0");

  const { data: inv, error: iErr } = await admin
    .schema("acct")
    .from("invoice")
    .insert({
      lease_id: (lease as any).id,
      type: (meter as any).utility_type,
      amount: total,
      due_date: input.due_date,
      status: "unpaid",
      display_number: display,
    })
    .select("id, display_number")
    .single();
  if (iErr) throw new Error(iErr.message);

  const { error: uErr } = await admin
    .schema("acct")
    .from("meter_reading")
    .update({ invoice_id: (inv as any).id })
    .eq("id", input.reading_id);
  if (uErr) throw new Error(uErr.message);

  return {
    invoice_id: (inv as any).id,
    display_number: (inv as any).display_number,
  };
}
`;

// ---------------------------------------------------------------------
// meters/page.tsx patch
// ---------------------------------------------------------------------

const METERS_PATH = "src/app/(dashboard)/property/meters/page.tsx";
const METERS_ORIGINAL_ACTION = `        action={
          <AddMeterDialog
            properties={properties.map((p) => ({ id: p.id, name: p.name }))}
            units={units}
          />
        }`;
const METERS_NEW_ACTION = `        action={
          <div className="flex gap-2">
            <Link
              href="/property/utilities/readings"
              className="inline-flex items-center rounded-md border border-line-300 px-3 py-1.5 text-sm font-medium hover:bg-surface-100"
            >
              Bulk readings
            </Link>
            <AddMeterDialog
              properties={properties.map((p) => ({ id: p.id, name: p.name }))}
              units={units}
            />
          </div>
        }`;

// ---------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------

function ensureDir(filePath) {
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function writeNew(file) {
  if (existsSync(file.path)) {
    console.log("SKIP  " + file.path + "  (already exists)");
    return;
  }
  ensureDir(file.path);
  writeFileSync(file.path, file.content, "utf8");
  console.log("WRITE " + file.path);
}

function patchDAL() {
  const p = "src/lib/db/utilities.ts";
  if (!existsSync(p)) {
    console.error("MISSING " + p + " - cannot patch");
    process.exit(1);
  }
  const src = readFileSync(p, "utf8");
  if (src.includes(DAL_MARKER)) {
    console.log("SKIP  " + p + "  (DAL block already present)");
    return;
  }
  writeFileSync(p + ".bak", src, "utf8");
  writeFileSync(p, src + DAL_APPEND, "utf8");
  console.log("PATCH " + p + "  (appended DAL functions; backup at .bak)");
}

function patchMetersPage() {
  if (!existsSync(METERS_PATH)) {
    console.error("MISSING " + METERS_PATH + " - cannot patch");
    process.exit(1);
  }
  let src = readFileSync(METERS_PATH, "utf8");
  if (src.includes("Bulk readings")) {
    console.log("SKIP  " + METERS_PATH + "  (link already present)");
    return;
  }
  if (!src.includes(METERS_ORIGINAL_ACTION)) {
    console.error(
      "MISSING anchor in " + METERS_PATH + " - could not find the exact action block. " +
      "Patch manually: add a Link to /property/utilities/readings next to AddMeterDialog."
    );
    return;
  }
  writeFileSync(METERS_PATH + ".bak", src, "utf8");
  src = src.replace(METERS_ORIGINAL_ACTION, METERS_NEW_ACTION);
  // Ensure Link import exists
  if (!src.includes('from "next/link"')) {
    src = src.replace(
      /^import Link from "next\/link";\n/m,
      ""
    );
    src = 'import Link from "next/link";\n' + src;
  }
  writeFileSync(METERS_PATH, src, "utf8");
  console.log("PATCH " + METERS_PATH + "  (added Bulk readings link; backup at .bak)");
}

function main() {
  console.log("=== apply-utility-readings.mjs ===");
  console.log("");

  console.log("[1/3] Writing new files...");
  for (const f of NEW_FILES) writeNew(f);
  console.log("");

  console.log("[2/3] Patching DAL...");
  patchDAL();
  console.log("");

  console.log("[3/3] Patching meters page...");
  patchMetersPage();
  console.log("");

  console.log("Done. Next:");
  console.log("  1. Verify Supabase project:  select table_schema, table_name from information_schema.tables where table_schema='acct';");
  console.log("  2. Apply migration:          npx supabase db push");
  console.log("  3. Typecheck:                npm run typecheck");
  console.log("  4. Build:                    npm run build");
  console.log("  5. Open:                     /property/utilities/readings");
  console.log("");
  console.log("Rollback: every modified file has a .bak next to it.");
}

main();