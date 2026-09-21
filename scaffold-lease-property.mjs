#!/usr/bin/env node
/**
 * Lease form — add Property + Address fields
 * Usage: node scaffold-lease-property.mjs
 *
 * Updates:
 *   src/components/lease/lease-form.tsx                       (add property + address)
 *   src/app/(dashboard)/property/leases/new/page.tsx          (load properties)
 *   src/app/(dashboard)/property/leases/[id]/page.tsx         (load properties)
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
// 1. Updated lease form
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

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" loading={pending}>{label}</Button>;
}

function adOnsToText(raw: unknown): string {
  if (!Array.isArray(raw)) return "";
  return raw.map((x: any) => (typeof x === "string" ? x : x.text ?? "")).filter(Boolean).join(", ");
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

  // ---- Determine initial property from the lease's unit ----
  const initialPropertyId = useMemo(() => {
    if (!lease) return "";
    const u = units.find((x) => x.id === lease.unit_id);
    return u?.property_id ?? "";
  }, [lease, units]);

  const [propertyId, setPropertyId] = useState<string>(initialPropertyId);

  // ---- Filter units by selected property ----
  const filteredUnits = useMemo(() => {
    if (!propertyId) return units;
    return units.filter((u) => u.property_id === propertyId);
  }, [units, propertyId]);

  // Reset unit selection if it no longer matches the property
  const [unitId, setUnitId] = useState<string>(lease?.unit_id ?? "");
  useEffect(() => {
    if (unitId && !filteredUnits.some((u) => u.id === unitId)) {
      setUnitId("");
    }
  }, [propertyId, filteredUnits, unitId]);

  // ---- Selected property for address display ----
  const selectedProperty = properties.find((p) => p.id === propertyId);

  const propertyOptions = properties.map((p) => ({
    value: p.id,
    label: p.name,
  }));

  const unitOptions = filteredUnits.map((u) => ({
    value: u.id,
    label: u.unit_number + (u.base_rent != null ? " · ₱" + Number(u.base_rent).toLocaleString("en-PH") : ""),
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
              {/* Property dropdown — NOT named, so it doesn't submit; it's a UI helper */}
              <Select
                label="Select property"
                options={propertyOptions}
                placeholder="— All properties —"
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
              />

              {/* Address — read-only display */}
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

          <div className="grid grid-cols-3 gap-4">
            <Select name="intent" label="Intent" options={INTENTS}
              defaultValue={lease?.intent ?? "new"} error={fieldError("intent")} />
            <Input name="start_date" label="Start date" type="date"
              defaultValue={lease?.start_date ?? ""} error={fieldError("start_date")} />
            <Input name="end_date" label="End of contract" type="date"
              defaultValue={lease?.end_date ?? ""} error={fieldError("end_date")} />
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
// 2. Updated /property/leases/new page — load properties
// =============================================================================
FILES["src/app/(dashboard)/property/leases/new/page.tsx"] =
`import { requirePagePermission } from "@/lib/auth/guard";
import { listUnits } from "@/lib/db/units";
import { listTenants } from "@/lib/db/tenants";
import { listProperties } from "@/lib/db/properties";
import { PageHeader } from "@/components/layout/page-header";
import { LeaseForm } from "@/components/lease/lease-form";

export default async function NewLeasePage() {
  await requirePagePermission("lease:create");
  const [units, tenants, properties] = await Promise.all([
    listUnits(),
    listTenants(),
    listProperties(),
  ]);

  return (
    <div>
      <PageHeader title="New Lease" description="Create a lease agreement." />
      <LeaseForm
        mode="create"
        units={units}
        tenants={tenants}
        properties={properties}
      />
    </div>
  );
}
`;

// =============================================================================
// 3. Updated /property/leases/[id] page — load properties
// =============================================================================
FILES["src/app/(dashboard)/property/leases/[id]/page.tsx"] =
`import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/guard";
import { getLease } from "@/lib/db/leases";
import { listUnits } from "@/lib/db/units";
import { listTenants } from "@/lib/db/tenants";
import { listProperties } from "@/lib/db/properties";
import { PageHeader } from "@/components/layout/page-header";
import { LeaseForm } from "@/components/lease/lease-form";
import { TerminateLeaseButton } from "@/components/lease/terminate-lease-button";

export default async function LeaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("lease:read");
  const { id } = await params;
  const lease = await getLease(id);
  if (!lease) notFound();

  const [units, tenants, properties] = await Promise.all([
    listUnits(),
    listTenants(),
    listProperties(),
  ]);

  return (
    <div>
      <PageHeader
        title={"Lease for Unit " + (lease.unit_number ?? "")}
        description={lease.tenant_name ?? ""}
        action={lease.status !== "terminated" ? <TerminateLeaseButton id={lease.id} /> : undefined}
      />
      <LeaseForm
        mode="edit"
        lease={lease}
        units={units}
        tenants={tenants}
        properties={properties}
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

  console.log("Lease form — Property + Address\n");

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
  console.log("  Visit /property/leases/new");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});