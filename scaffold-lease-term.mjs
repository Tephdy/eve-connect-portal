#!/usr/bin/env node
/**
 * Lease — add term field (1 month / 6 months / 1 year / etc.)
 * Usage: node scaffold-lease-term.mjs
 *
 * Updates:
 *   src/lib/schemas/lease.ts                       (add term to Zod schema)
 *   src/lib/db/leases.ts                           (add term to type + select + writes)
 *   src/components/lease/lease-form.tsx            (add Term dropdown + auto-fill end date)
 *   src/components/lease/lease-table.tsx           (show Term column)
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
// 1. Zod schema
// =============================================================================
FILES["src/lib/schemas/lease.ts"] =
`import { z } from "zod";

export const leaseStatuses = ["draft","active","expiring","ended","terminated"] as const;
export const leaseIntents = ["new","renew","extend"] as const;

export const leaseTerms = [
  "1_month",
  "3_months",
  "6_months",
  "1_year",
  "2_years",
  "3_years",
  "other",
] as const;

export const leaseCreateSchema = z.object({
  unit_id: z.string().uuid("Unit is required"),
  tenant_id: z.string().uuid("Tenant is required"),
  start_date: z.string().min(1, "Start date is required"),
  end_date: z.string().min(1, "End of contract is required"),
  move_in_date: z.string().optional().or(z.literal("")),
  due_date: z.string().optional().or(z.literal("")),
  intent: z.enum(leaseIntents).default("new"),
  term: z.enum(leaseTerms).optional(),
  monthly_rent: z.coerce.number().min(0),
  deposit_1: z.coerce.number().min(0).default(0),
  deposit_2: z.coerce.number().min(0).default(0),
  deposit_amount: z.coerce.number().min(0).default(0),
  notice_period_days: z.coerce.number().int().min(0).default(30),
  ad_ons: z.string().optional().or(z.literal("")),
  ad_ons_amount: z.coerce.number().min(0).default(0),
  status: z.enum(leaseStatuses).default("draft"),
}).refine((d) => new Date(d.end_date) > new Date(d.start_date), {
  message: "End of contract must be after start date",
  path: ["end_date"],
});

export const leaseUpdateSchema = leaseCreateSchema.innerType().partial();

export type LeaseCreateInput = z.infer<typeof leaseCreateSchema>;
export type LeaseUpdateInput = z.infer<typeof leaseUpdateSchema>;
`;

// =============================================================================
// 2. DB layer — add term
// =============================================================================
FILES["src/lib/db/leases.ts"] =
`import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { LeaseCreateInput, LeaseUpdateInput } from "@/lib/schemas/lease";

export type Lease = {
  id: string;
  unit_id: string;
  tenant_id: string;
  start_date: string;
  end_date: string;
  move_in_date: string | null;
  due_date: string | null;
  intent: "new" | "renew" | "extend" | null;
  term: string | null;
  monthly_rent: number;
  deposit_amount: number;
  deposit_1: number | null;
  deposit_2: number | null;
  ad_ons: unknown;
  ad_ons_amount: number | null;
  notice_period_days: number;
  status: "draft" | "active" | "expiring" | "ended" | "terminated";
  created_at: string;
  unit_number?: string;
  tenant_name?: string;
};

const LEASE_SELECT =
  "id, unit_id, tenant_id, start_date, end_date, monthly_rent, deposit_amount, notice_period_days, status, created_at, due_date, deposit_1, deposit_2, move_in_date, intent, ad_ons, ad_ons_amount, term, unit_number, tenant_name";

function parseAdOns(raw: string | undefined | null): unknown[] {
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean).map((text) => ({ text }));
}

function logWriteError(fn: string, error: any) {
  console.error("[" + fn + "]", JSON.stringify(error, null, 2));
}

export async function listLeases(): Promise<Lease[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lease")
    .select(LEASE_SELECT)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Lease[];
}

export async function getLease(id: string): Promise<Lease | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lease")
    .select(LEASE_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Lease) ?? null;
}

export async function createLease(input: LeaseCreateInput): Promise<Lease> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("lease")
    .insert({
      unit_id: input.unit_id,
      tenant_id: input.tenant_id,
      start_date: input.start_date,
      end_date: input.end_date,
      move_in_date: input.move_in_date || null,
      due_date: input.due_date || null,
      intent: input.intent ?? "new",
      term: input.term ?? null,
      monthly_rent: input.monthly_rent,
      deposit_amount: input.deposit_amount ?? 0,
      deposit_1: input.deposit_1 ?? 0,
      deposit_2: input.deposit_2 ?? 0,
      notice_period_days: input.notice_period_days,
      ad_ons: parseAdOns(typeof input.ad_ons === "string" ? input.ad_ons : ""),
      ad_ons_amount: input.ad_ons_amount ?? 0,
      status: input.status,
    })
    .select(LEASE_SELECT)
    .single();
  if (error) {
    logWriteError("createLease", error);
    throw new Error(error.message);
  }
  return data as Lease;
}

export async function updateLease(id: string, input: LeaseUpdateInput): Promise<Lease> {
  const admin = createAdminClient();
  const patch: Record<string, unknown> = {};

  if (input.unit_id !== undefined) patch.unit_id = input.unit_id;
  if (input.tenant_id !== undefined) patch.tenant_id = input.tenant_id;
  if (input.start_date !== undefined) patch.start_date = input.start_date;
  if (input.end_date !== undefined) patch.end_date = input.end_date;
  if (input.move_in_date !== undefined) patch.move_in_date = input.move_in_date || null;
  if (input.due_date !== undefined) patch.due_date = input.due_date || null;
  if (input.intent !== undefined) patch.intent = input.intent;
  if (input.term !== undefined) patch.term = input.term;
  if (input.monthly_rent !== undefined) patch.monthly_rent = input.monthly_rent;
  if (input.deposit_amount !== undefined) patch.deposit_amount = input.deposit_amount;
  if (input.deposit_1 !== undefined) patch.deposit_1 = input.deposit_1;
  if (input.deposit_2 !== undefined) patch.deposit_2 = input.deposit_2;
  if (input.notice_period_days !== undefined) patch.notice_period_days = input.notice_period_days;
  if (input.ad_ons !== undefined) {
    patch.ad_ons = parseAdOns(typeof input.ad_ons === "string" ? input.ad_ons : "");
  }
  if (input.ad_ons_amount !== undefined) patch.ad_ons_amount = input.ad_ons_amount;
  if (input.status !== undefined) patch.status = input.status;

  const { data, error } = await admin
    .from("lease").update(patch).eq("id", id).select(LEASE_SELECT).single();
  if (error) {
    logWriteError("updateLease", error);
    throw new Error(error.message);
  }
  return data as Lease;
}

export async function terminateLease(id: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("lease").update({ status: "terminated" }).eq("id", id);
  if (error) {
    logWriteError("terminateLease", error);
    throw new Error(error.message);
  }
}
`;

// =============================================================================
// 3. Lease form — add term + auto-fill end date when term changes
// =============================================================================
FILES["src/components/lease/lease-form.tsx"] =
`"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Building2, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { createLeaseAction, updateLeaseAction } from "@/app/(dashboard)/property/leases/actions";
import type { ActionResult } from "@/lib/actions/result";
import type { Lease } from "@/lib/db/leases";
import type { Unit } from "@/lib/db/units";
import type { Tenant } from "@/lib/db/tenants";
import type { Property } from "@/lib/db/properties";

const STATUSES = [
  { value: "draft",      label: "Draft" },
  { value: "active",     label: "Active" },
  { value: "expiring",   label: "Expiring" },
  { value: "ended",      label: "Ended" },
  { value: "terminated", label: "Terminated" },
];

const INTENTS = [
  { value: "new",    label: "New" },
  { value: "renew",  label: "Renew" },
  { value: "extend", label: "Extend" },
];

const TERMS = [
  { value: "1_month",  label: "1 month",  months: 1 },
  { value: "3_months", label: "3 months", months: 3 },
  { value: "6_months", label: "6 months", months: 6 },
  { value: "1_year",   label: "1 year",   months: 12 },
  { value: "2_years",  label: "2 years",  months: 24 },
  { value: "3_years",  label: "3 years",  months: 36 },
  { value: "other",    label: "Other (manual)", months: 0 },
];

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" loading={pending}>{label}</Button>;
}

function adOnsToText(raw: unknown): string {
  if (!Array.isArray(raw)) return "";
  return raw.map((x: any) => (typeof x === "string" ? x : x.text ?? "")).filter(Boolean).join(", ");
}

function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setMonth(dt.getMonth() + months);
  // If original day was 31 and target month has fewer, clamp
  const lastDay = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
  if (dt.getDate() > lastDay) dt.setDate(lastDay);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return yy + "-" + mm + "-" + dd;
}

export function LeaseForm({
  mode,
  lease,
  units,
  tenants,
  properties,
}: {
  mode: "create" | "edit";
  lease?: Lease;
  units: Unit[];
  tenants: Tenant[];
  properties: Property[];
}) {
  const router = useRouter();
  const toast = useToast();
  const action = mode === "create" ? createLeaseAction : updateLeaseAction.bind(null, lease!.id);
  const [state, formAction] = useActionState<ActionResult | null, FormData>(action, null);

  useEffect(() => {
    if (state?.ok) {
      toast.push(mode === "create" ? "Lease created" : "Lease updated", "success");
      if (mode === "edit") router.refresh();
    } else if (state && !state.ok) {
      toast.push(state.error, "error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const fieldError = (k: string) => (state && !state.ok ? state.fieldErrors?.[k] : undefined);

  // ---- Property state ----
  const initialPropertyId = useMemo(() => {
    if (!lease) return "";
    const u = units.find((x) => x.id === lease.unit_id);
    return u?.property_id ?? "";
  }, [lease, units]);

  const [propertyId, setPropertyId] = useState<string>(initialPropertyId);

  const filteredUnits = useMemo(() => {
    if (!propertyId) return units;
    return units.filter((u) => u.property_id === propertyId);
  }, [units, propertyId]);

  const [unitId, setUnitId] = useState<string>(lease?.unit_id ?? "");
  useEffect(() => {
    if (unitId && !filteredUnits.some((u) => u.id === unitId)) {
      setUnitId("");
    }
  }, [propertyId, filteredUnits, unitId]);

  const selectedProperty = properties.find((p) => p.id === propertyId);

  // ---- Term + date auto-fill state ----
  const [term, setTerm] = useState<string>(lease?.term ?? "1_year");
  const [startDate, setStartDate] = useState<string>(lease?.start_date ?? "");
  const [endDate, setEndDate] = useState<string>(lease?.end_date ?? "");

  // When term or start date changes, auto-fill end date (unless "other")
  useEffect(() => {
    if (!startDate || !term || term === "other") return;
    const def = TERMS.find((t) => t.value === term);
    if (!def || def.months === 0) return;
    const computed = addMonths(startDate, def.months);
    // If end date is blank OR matches what the previous term would have produced,
    // update it. Otherwise leave the user's manual override alone.
    if (!endDate || endDate !== computed) {
      // Only auto-update on term/start changes; user can still edit afterward
      setEndDate(computed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, startDate]);

  const propertyOptions = properties.map((p) => ({
    value: p.id,
    label: p.name,
  }));

  const unitOptions = filteredUnits.map((u) => ({
    value: u.id,
    label: u.unit_number,
  }));

  const tenantOptions = tenants.map((t) => ({ value: t.id, label: t.full_name }));

  return (
    <Card className="max-w-3xl">
      <CardBody>
        <form action={formAction} className="space-y-5">

          {/* ---- Property + Address ---- */}
          <div className="rounded-xl border border-ink-200 bg-ink-50/40 p-4 dark:border-white/[0.06] dark:bg-white/[0.02]">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-500/10 text-brand-600 dark:text-brand-400">
                <Building2 className="h-3.5 w-3.5" />
              </div>
              <p className="text-sm font-medium text-ink-800">Property</p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Select
                label="Select property"
                options={propertyOptions}
                placeholder="— All properties —"
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
              />

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-ink-700">Address</label>
                <div className="flex min-h-9 items-center gap-2 rounded-md border border-ink-200 bg-surface-muted px-3 py-2 text-sm text-ink-700 dark:border-white/[0.06] dark:bg-white/[0.02]">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-ink-400" />
                  <span className="truncate">
                    {selectedProperty?.address ?? "Select a property to see the address"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ---- Unit + Tenant ---- */}
          <div className="grid grid-cols-2 gap-4">
            <Select
              name="unit_id"
              label="Unit"
              options={unitOptions}
              placeholder={propertyId ? "Select a unit" : "Pick a property first"}
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
              error={fieldError("unit_id")}
              disabled={!propertyId && propertyOptions.length > 0}
            />
            <Select
              name="tenant_id"
              label="Tenant"
              options={tenantOptions}
              placeholder="Select a tenant"
              defaultValue={lease?.tenant_id ?? ""}
              error={fieldError("tenant_id")}
            />
          </div>

          {/* ---- Intent + Term ---- */}
          <div className="grid grid-cols-2 gap-4">
            <Select
              name="intent"
              label="Intent"
              options={INTENTS}
              defaultValue={lease?.intent ?? "new"}
              error={fieldError("intent")}
            />
            <Select
              name="term"
              label="Contract term"
              options={TERMS.map((t) => ({ value: t.value, label: t.label }))}
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              error={fieldError("term")}
              hint={term === "other" ? "Enter the end date manually" : "End date auto-calculated from start date"}
            />
          </div>

          {/* ---- Dates ---- */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              name="start_date"
              label="Start date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              error={fieldError("start_date")}
            />
            <Input
              name="end_date"
              label="End of contract"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              error={fieldError("end_date")}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input name="move_in_date" label="Move-in date" type="date"
              defaultValue={lease?.move_in_date ?? ""} error={fieldError("move_in_date")} />
            <Input name="due_date" label="Rent due date" type="date"
              defaultValue={lease?.due_date ?? ""} error={fieldError("due_date")}
              hint="Date rent is due each month" />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Input name="monthly_rent" label="Monthly rent (PHP)" type="number" step="0.01" min={0}
              defaultValue={lease?.monthly_rent ?? ""} error={fieldError("monthly_rent")} />
            <Input name="deposit_1" label="1st Deposit (PHP)" type="number" step="0.01" min={0}
              defaultValue={lease?.deposit_1 ?? 0} error={fieldError("deposit_1")} />
            <Input name="deposit_2" label="2nd Deposit (PHP)" type="number" step="0.01" min={0}
              defaultValue={lease?.deposit_2 ?? 0} error={fieldError("deposit_2")} />
          </div>

          <div>
            <Input
              name="ad_ons"
              label="Add-ons"
              hint="Comma-separated: Foam, AC, Bedframe, Others"
              defaultValue={adOnsToText(lease?.ad_ons)}
              error={fieldError("ad_ons")}
            />
            <div className="mt-3">
              <Input
                name="ad_ons_amount"
                label="Add-ons amount (PHP)"
                type="number"
                step="0.01"
                min={0}
                defaultValue={lease?.ad_ons_amount ?? 0}
                error={fieldError("ad_ons_amount")}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input name="notice_period_days" label="Notice period (days)" type="number" min={0}
              defaultValue={lease?.notice_period_days ?? 30} error={fieldError("notice_period_days")} />
            <Select name="status" label="Status" options={STATUSES}
              defaultValue={lease?.status ?? "draft"} error={fieldError("status")} />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <SubmitButton label={mode === "create" ? "Create Lease" : "Save Changes"} />
            <Button type="button" variant="secondary" onClick={() => router.push("/property/leases")}>
              Cancel
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
`;

// =============================================================================
// 4. Lease table — add Term column
// =============================================================================
FILES["src/components/lease/lease-table.tsx"] =
`import Link from "next/link";
import { FileText } from "lucide-react";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Card, CardBody } from "@/components/ui/card";
import { StatusPill } from "@/components/dashboard/status-pill";
import { formatPHP } from "@/lib/utils/format-php";
import type { Lease } from "@/lib/db/leases";

const STATUS_TONE: Record<string, "gray" | "green" | "yellow" | "red" | "brand"> = {
  draft: "gray",
  active: "green",
  expiring: "yellow",
  ended: "brand",
  terminated: "red",
};

const TERM_LABEL: Record<string, string> = {
  "1_month": "1 month",
  "3_months": "3 months",
  "6_months": "6 months",
  "1_year": "1 year",
  "2_years": "2 years",
  "3_years": "3 years",
  other: "Other",
};

export function LeaseTable({ leases }: { leases: Lease[] }) {
  return (
    <Card className="overflow-hidden">
      <CardBody className="p-0">
        <Table>
          <THead>
            <TR>
              <TH>Lease</TH>
              <TH>Tenant</TH>
              <TH>Term</TH>
              <TH>Dates</TH>
              <TH className="text-right">Rent</TH>
              <TH>Status</TH>
              <TH className="text-right"></TH>
            </TR>
          </THead>
          <TBody>
            {leases.map((l) => (
              <TR key={l.id}>
                <TD>
                  <Link
                    href={"/property/leases/" + l.id}
                    className="flex items-center gap-3 group"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-ink-900 group-hover:text-brand-600 dark:group-hover:text-brand-400">
                        Unit {l.unit_number ?? "—"}
                      </p>
                      {l.intent && (
                        <p className="text-xs capitalize text-ink-500">{l.intent}</p>
                      )}
                    </div>
                  </Link>
                </TD>
                <TD className="text-ink-600">{l.tenant_name ?? "—"}</TD>
                <TD>
                  {l.term ? (
                    <span className="text-sm text-ink-700">
                      {TERM_LABEL[l.term] ?? l.term}
                    </span>
                  ) : (
                    <span className="text-sm text-ink-400">—</span>
                  )}
                </TD>
                <TD>
                  <div className="text-xs text-ink-500">
                    {new Date(l.start_date).toLocaleDateString("en-PH", {
                      month: "short",
                      day: "numeric",
                      year: "2-digit",
                    })}
                    {" → "}
                    {new Date(l.end_date).toLocaleDateString("en-PH", {
                      month: "short",
                      day: "numeric",
                      year: "2-digit",
                    })}
                  </div>
                </TD>
                <TD className="text-right font-medium text-ink-900">
                  {formatPHP(l.monthly_rent)}
                </TD>
                <TD>
                  <StatusPill tone={STATUS_TONE[l.status] ?? "gray"} dot>
                    {l.status}
                  </StatusPill>
                </TD>
                <TD className="text-right">
                  <Link
                    href={"/property/leases/" + l.id}
                    className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
                  >
                    View
                  </Link>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </CardBody>
    </Card>
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

  console.log("Lease — add contract term field\\n");

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
  console.log("  1. Run the 029_lease_term.sql migration in Supabase");
  console.log("  2. npm run typecheck");
  console.log("  3. npm run dev");
  console.log("\\nTest:");
  console.log("  - New Lease: pick a term → End date auto-fills from Start date");
  console.log("  - Lease list shows the Term column");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});