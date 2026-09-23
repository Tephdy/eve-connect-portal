"use client";

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
import type { ReservationRow } from "@/lib/db/unit-reservations";

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
  return raw
    .map((x: any) => (typeof x === "string" ? x : x.text ?? x.label ?? ""))
    .filter(Boolean)
    .join(", ");
}

function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setMonth(dt.getMonth() + months);
  const lastDay = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
  if (dt.getDate() > lastDay) dt.setDate(lastDay);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return yy + "-" + mm + "-" + dd;
}

// Match a reservation to a tenant in the list using:
// 1. email  →  2. phone  →  3. name (case-insensitive). Returns "" if no match.
function findTenantId(
  tenants: Tenant[],
  r: { client_name: string; client_email: string | null; client_phone: string | null }
): string {
  const email = (r.client_email ?? "").trim().toLowerCase();
  const phone = (r.client_phone ?? "").trim();
  const name = (r.client_name ?? "").trim().toLowerCase();

  if (email) {
    const hit = tenants.find((t) => (t.email ?? "").trim().toLowerCase() === email);
    if (hit) return hit.id;
  }
  if (phone) {
    const hit = tenants.find((t) => (t.phone ?? "").trim() === phone);
    if (hit) return hit.id;
  }
  if (name) {
    const hit = tenants.find((t) => (t.full_name ?? "").trim().toLowerCase() === name);
    if (hit) return hit.id;
  }
  return "";
}

export function LeaseForm({
  mode,
  lease,
  units,
  tenants,
  properties,
  reservations,
}: {
  mode: "create" | "edit";
  lease?: Lease;
  units: Unit[];
  tenants: Tenant[];
  properties: Property[];
  reservations?: ReservationRow[];
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

  // ---------------------------------------------------------------------------
  // Controlled state for every autofillable field
  // ---------------------------------------------------------------------------

  const initialPropertyId = useMemo(() => {
    if (!lease) return "";
    const u = units.find((x) => x.id === lease.unit_id);
    return u?.property_id ?? "";
  }, [lease, units]);

  const [reservationId, setReservationId] = useState("");
  const [propertyId, setPropertyId] = useState<string>(initialPropertyId);
  const [unitId, setUnitId] = useState<string>(lease?.unit_id ?? "");
  const [tenantId, setTenantId] = useState<string>(lease?.tenant_id ?? "");
  const [tenantName, setTenantName] = useState<string>(() => {
    if (lease?.tenant_name) return lease.tenant_name;
    if (lease?.tenant_id) {
      const t = tenants.find((x) => x.id === lease.tenant_id);
      return t?.full_name ?? "";
    }
    return "";
  });
  const [intent, setIntent] = useState<string>(lease?.intent ?? "new");
  const [term, setTerm] = useState<string>(lease?.term ?? "1_year");
  const [startDate, setStartDate] = useState<string>(lease?.start_date ?? "");
  const [endDate, setEndDate] = useState<string>(lease?.end_date ?? "");
  const [moveInDate, setMoveInDate] = useState<string>(lease?.move_in_date ?? "");
  const [dueDate, setDueDate] = useState<string>(lease?.due_date ?? "");
  const [monthlyRent, setMonthlyRent] = useState<string>(
    lease?.monthly_rent != null ? String(lease.monthly_rent) : ""
  );
  const [deposit1, setDeposit1] = useState<string>(
    lease?.deposit_1 != null ? String(lease.deposit_1) : "0"
  );
  const [deposit2, setDeposit2] = useState<string>(
    lease?.deposit_2 != null ? String(lease.deposit_2) : "0"
  );
  const [deposit1Due, setDeposit1Due] = useState<string>(
    lease?.deposit_1_due_date ?? ""
  );
  const [deposit2Due, setDeposit2Due] = useState<string>(
    lease?.deposit_2_due_date ?? ""
  );
  const [adOns, setAdOns] = useState<string>(adOnsToText(lease?.ad_ons));
  const [adOnsAmount, setAdOnsAmount] = useState<string>(
    lease?.ad_ons_amount != null ? String(lease.ad_ons_amount) : "0"
  );
  const [noticePeriod, setNoticePeriod] = useState<string>(
    lease?.notice_period_days != null ? String(lease.notice_period_days) : "30"
  );
  const [status, setStatus] = useState<string>(lease?.status ?? "draft");

  // Filter units by property
  const filteredUnits = useMemo(() => {
    if (!propertyId) return units;
    return units.filter((u) => u.property_id === propertyId);
  }, [units, propertyId]);

  // If the currently selected unit isn't in the filtered list, clear it
  useEffect(() => {
    if (unitId && !filteredUnits.some((u) => u.id === unitId)) {
      setUnitId("");
    }
  }, [propertyId, filteredUnits, unitId]);

  // Auto-fill end date when term or start date changes (unless "other")
  useEffect(() => {
    if (!startDate || !term || term === "other") return;
    const def = TERMS.find((t) => t.value === term);
    if (!def || def.months === 0) return;
    setEndDate(addMonths(startDate, def.months));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, startDate]);

  // ---------------------------------------------------------------------------
  // Autofill everything from the picked reservation
  // ---------------------------------------------------------------------------

  function applyReservation(id: string) {
    setReservationId(id);
    if (!id || !reservations) return;
    const r = reservations.find((x) => x.id === id);
    if (!r) return;

    // Property (via the unit the reservation references)
    const unit = units.find((u) => u.id === r.unit_id);
    if (unit) {
      setPropertyId(unit.property_id);
      setUnitId(unit.id);
    }

    // Tenant matching — email → phone → name
    const matchedTenantId = findTenantId(tenants, {
      client_name: r.client_name,
      client_email: r.client_email,
      client_phone: r.client_phone,
    });
    setTenantId(matchedTenantId);
    const matchedTenant = tenants.find((t) => t.id === matchedTenantId);
    setTenantName(matchedTenant?.full_name ?? r.client_name);

    // Lease draft fields
    if (r.intent && ["new", "renew", "extend"].includes(r.intent)) setIntent(r.intent);
    if (r.term) setTerm(r.term);
    if (r.lease_start_date) setStartDate(r.lease_start_date);
    if (r.lease_end_date) setEndDate(r.lease_end_date);
    if (r.move_in_date) setMoveInDate(r.move_in_date);
    if (r.rent_due_date) setDueDate(r.rent_due_date);
    if (r.monthly_rent != null) setMonthlyRent(String(r.monthly_rent));
    if (r.deposit_1 != null) setDeposit1(String(r.deposit_1));
    if (r.deposit_2 != null) setDeposit2(String(r.deposit_2));
    if (r.deposit_1_due_date) setDeposit1Due(r.deposit_1_due_date);
    if (r.deposit_2_due_date) setDeposit2Due(r.deposit_2_due_date);
    if (r.notice_period_days != null) setNoticePeriod(String(r.notice_period_days));

    // Add-ons: [ { label, amount } ] -> "Label1, Label2"
    const addOns = (r.add_ons ?? []) as { label: string; amount: number }[];
    if (Array.isArray(addOns) && addOns.length > 0) {
      setAdOns(addOns.map((a) => a.label).filter(Boolean).join(", "));
      setAdOnsAmount(String(addOns.reduce((s, a) => s + Number(a.amount ?? 0), 0)));
    }

    // Lease status from reservation
    if (r.lease_status === "active") setStatus("active");
  }

  const propertyOptions = properties.map((p) => ({ value: p.id, label: p.name }));
  const unitOptions = filteredUnits.map((u) => ({ value: u.id, label: u.unit_number }));
  const selectedProperty = properties.find((p) => p.id === propertyId);

  return (
    <Card className="max-w-3xl">
      <CardBody>
        <form action={formAction} className="space-y-5">
          {mode === "create" && reservations && reservations.length > 0 && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 dark:border-emerald-500/20">
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                From verified reservation
              </label>
              <select
                value={reservationId}
                onChange={(e) => applyReservation(e.target.value)}
                className="w-full rounded-lg border border-white/60 bg-white/70 px-3 py-1.5 text-sm dark:border-white/[0.08] dark:bg-white/[0.04]"
              >
                <option value="">— Start from scratch —</option>
                {reservations.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.client_name}
                    {r.unit_number ? " · Unit " + r.unit_number : ""}
                    {r.monthly_rent ? " · ₱" + Number(r.monthly_rent).toLocaleString("en-PH") : ""}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
                Picking a reservation will pre-fill the lease fields below.
              </p>
            </div>
          )}
          {reservationId && (
            <input type="hidden" name="from_reservation_id" value={reservationId} />
          )}

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
            <div>
              <Input
                label="Tenant"
                list="tenant-list"
                value={tenantName}
                onChange={(e) => {
                  setTenantName(e.target.value);
                  const match = tenants.find(
                    (t) =>
                      t.full_name.trim().toLowerCase() ===
                      e.target.value.trim().toLowerCase()
                  );
                  setTenantId(match?.id ?? "");
                }}
                placeholder="Type tenant name"
                error={state && !state.ok ? fieldError("tenant_id") : undefined}
              />
              {tenantName && !tenantId && (
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-500">
                  No matching tenant found.{" "}
                  <a
                    href="/property/tenants/new"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium underline"
                  >
                    Create the tenant first
                  </a>
                  , then come back here.
                </p>
              )}
              <datalist id="tenant-list">
                {tenants.map((t) => (
                  <option key={t.id} value={t.full_name} />
                ))}
              </datalist>
              <input type="hidden" name="tenant_id" value={tenantId} />
            </div>
          </div>

          {/* ---- Intent + Term ---- */}
          <div className="grid grid-cols-2 gap-4">
            <Select
              name="intent"
              label="Intent"
              options={INTENTS}
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
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
            <Input
              name="move_in_date"
              label="Move-in date"
              type="date"
              value={moveInDate}
              onChange={(e) => setMoveInDate(e.target.value)}
              error={fieldError("move_in_date")}
            />
            <Input
              name="due_date"
              label="Rent due date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              error={fieldError("due_date")}
              hint="Date rent is due each month"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Input
              name="monthly_rent"
              label="Monthly rent (PHP)"
              type="number"
              step="0.01"
              min={0}
              value={monthlyRent}
              onChange={(e) => setMonthlyRent(e.target.value)}
              error={fieldError("monthly_rent")}
            />
            <Input
              name="deposit_1"
              label="1st Deposit (PHP)"
              type="number"
              step="0.01"
              min={0}
              value={deposit1}
              onChange={(e) => setDeposit1(e.target.value)}
              error={fieldError("deposit_1")}
            />
            <Input
              name="deposit_1_due_date"
              label="1st Deposit due date"
              type="date"
              value={deposit1Due}
              onChange={(e) => setDeposit1Due(e.target.value)}
              error={fieldError("deposit_1_due_date")}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Input
              name="deposit_2"
              label="2nd Deposit (PHP)"
              type="number"
              step="0.01"
              min={0}
              value={deposit2}
              onChange={(e) => setDeposit2(e.target.value)}
              error={fieldError("deposit_2")}
            />
            <Input
              name="deposit_2_due_date"
              label="2nd Deposit due date"
              type="date"
              value={deposit2Due}
              onChange={(e) => setDeposit2Due(e.target.value)}
              error={fieldError("deposit_2_due_date")}
            />
            <div />
          </div>

          <div>
            <Input
              name="ad_ons"
              label="Add-ons"
              hint="Comma-separated: Foam, AC, Bedframe, Others"
              value={adOns}
              onChange={(e) => setAdOns(e.target.value)}
              error={fieldError("ad_ons")}
            />
            <div className="mt-3">
              <Input
                name="ad_ons_amount"
                label="Add-ons amount (PHP)"
                type="number"
                step="0.01"
                min={0}
                value={adOnsAmount}
                onChange={(e) => setAdOnsAmount(e.target.value)}
                error={fieldError("ad_ons_amount")}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              name="notice_period_days"
              label="Notice period (days)"
              type="number"
              min={0}
              value={noticePeriod}
              onChange={(e) => setNoticePeriod(e.target.value)}
              error={fieldError("notice_period_days")}
            />
            <Select
              name="status"
              label="Status"
              options={STATUSES}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              error={fieldError("status")}
            />
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