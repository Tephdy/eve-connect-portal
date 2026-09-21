#!/usr/bin/env node
/**
 * Property + Unit + Lease profile pages
 * Usage: node scaffold-entity-profiles.mjs
 *
 * Creates:
 *   src/lib/db/property-profile.ts
 *   src/lib/db/unit-profile.ts
 *   src/lib/db/lease-profile.ts
 *   src/components/property/profile-header.tsx
 *   src/components/property/tabs/overview-tab.tsx
 *   src/components/property/tabs/units-tab.tsx
 *   src/components/property/tabs/leases-tab.tsx
 *   src/components/property/tabs/activity-tab.tsx
 *   src/components/property/property-profile.tsx
 *   src/components/unit/profile-header.tsx
 *   src/components/unit/tabs/overview-tab.tsx
 *   src/components/unit/tabs/lease-history-tab.tsx
 *   src/components/unit/tabs/job-orders-tab.tsx
 *   src/components/unit/tabs/assets-tab.tsx
 *   src/components/unit/unit-profile.tsx
 *   src/components/lease/profile-header.tsx
 *   src/components/lease/tabs/overview-tab.tsx
 *   src/components/lease/tabs/invoices-tab.tsx
 *   src/components/lease/tabs/payments-tab.tsx
 *   src/components/lease/tabs/deposits-tab.tsx
 *   src/components/lease/tabs/activity-tab.tsx
 *   src/components/lease/lease-profile.tsx
 *
 * Updates:
 *   src/app/(dashboard)/property/properties/[id]/page.tsx
 *   src/app/(dashboard)/property/units/[id]/page.tsx
 *   src/app/(dashboard)/property/leases/[id]/page.tsx
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
// PROPERTY PROFILE — data
// =============================================================================
FILES["src/lib/db/property-profile.ts"] =
`import "server-only";
import { createClient } from "@/lib/supabase/server";

export type PropertyProfile = {
  property: {
    id: string;
    name: string;
    address: string | null;
    type: string;
    total_units: number;
    created_at: string;
    archived_at: string | null;
  };
  units: Array<{
    id: string;
    unit_number: string;
    floor: number | null;
    bedrooms: number | null;
    bathrooms: number | null;
    area_sqm: number | null;
    base_rent: number | null;
    status: string;
  }>;
  leases: Array<{
    id: string;
    unit_id: string;
    unit_number: string | null;
    tenant_id: string;
    tenant_name: string | null;
    start_date: string;
    end_date: string;
    monthly_rent: number;
    status: string;
    term: string | null;
  }>;
  activity: Array<{
    id: string;
    action: string;
    entity_type: string;
    entity_id: string;
    created_at: string;
    reason: string | null;
  }>;
  stats: {
    total_units: number;
    occupied: number;
    vacant: number;
    maintenance: number;
    occupancy_pct: number;
    monthly_revenue: number;
    active_leases: number;
  };
};

export async function getPropertyProfile(id: string): Promise<PropertyProfile | null> {
  const supabase = await createClient();

  const { data: property } = await supabase
    .from("property")
    .select("id, name, address, type, total_units, created_at, archived_at")
    .eq("id", id)
    .maybeSingle();

  if (!property) return null;

  const { data: units } = await supabase
    .from("unit")
    .select("id, unit_number, floor, bedrooms, bathrooms, area_sqm, base_rent, status")
    .eq("property_id", id)
    .order("unit_number");

  const unitRows = (units ?? []) as any[];
  const unitIds = unitRows.map((u) => u.id);

  let leases: any[] = [];
  if (unitIds.length > 0) {
    const { data } = await supabase
      .from("lease")
      .select(
        "id, unit_id, unit_number, tenant_id, tenant_name, start_date, end_date, monthly_rent, status, term"
      )
      .in("unit_id", unitIds)
      .order("start_date", { ascending: false });
    leases = data ?? [];
  }

  const entityIds = [id, ...unitIds];

  const { data: activity } = entityIds.length > 0
    ? await supabase
        .from("audit_log")
        .select("id, action, entity_type, entity_id, created_at, reason")
        .in("entity_id", entityIds)
        .order("created_at", { ascending: false })
        .limit(30)
    : { data: [] as any[] };

  const total_units = unitRows.length;
  const occupied = unitRows.filter((u) => u.status === "occupied").length;
  const vacant = unitRows.filter((u) => u.status === "vacant").length;
  const maintenance = unitRows.filter((u) => u.status === "maintenance").length;
  const occupancy_pct = total_units > 0 ? Math.round((occupied / total_units) * 100) : 0;
  const active_leases = leases.filter((l) => l.status === "active" || l.status === "expiring").length;
  const monthly_revenue = leases
    .filter((l) => l.status === "active" || l.status === "expiring")
    .reduce((s, l) => s + Number(l.monthly_rent ?? 0), 0);

  return {
    property,
    units: unitRows,
    leases,
    activity: (activity ?? []) as any[],
    stats: {
      total_units,
      occupied,
      vacant,
      maintenance,
      occupancy_pct,
      monthly_revenue,
      active_leases,
    },
  };
}
`;

// =============================================================================
// UNIT PROFILE — data
// =============================================================================
FILES["src/lib/db/unit-profile.ts"] =
`import "server-only";
import { createClient } from "@/lib/supabase/server";

export type UnitProfile = {
  unit: {
    id: string;
    property_id: string;
    property_name: string | null;
    property_address: string | null;
    unit_number: string;
    floor: number | null;
    bedrooms: number | null;
    bathrooms: number | null;
    area_sqm: number | null;
    base_rent: number | null;
    status: string;
    created_at: string;
  };
  leases: Array<{
    id: string;
    tenant_id: string;
    tenant_name: string | null;
    start_date: string;
    end_date: string;
    monthly_rent: number;
    status: string;
    term: string | null;
    intent: string | null;
  }>;
  jobOrders: Array<{
    id: string;
    task_type_name: string | null;
    priority: string;
    status: string;
    description: string | null;
    cost_estimate: number | null;
    created_at: string;
  }>;
  assets: Array<{
    id: string;
    name: string;
    type: string | null;
    install_date: string | null;
    warranty_until: string | null;
  }>;
  stats: {
    current_tenant: string | null;
    lease_status: string | null;
    monthly_rent: number;
    lease_end: string | null;
    open_jobs: number;
    total_assets: number;
  };
};

export async function getUnitProfile(id: string): Promise<UnitProfile | null> {
  const supabase = await createClient();

  const { data: unit } = await supabase
    .from("unit")
    .select(
      "id, property_id, unit_number, floor, bedrooms, bathrooms, area_sqm, base_rent, status, created_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (!unit) return null;

  const { data: property } = await supabase
    .from("property")
    .select("id, name, address")
    .eq("id", unit.property_id)
    .maybeSingle();

  const { data: leases } = await supabase
    .from("lease")
    .select("id, tenant_id, tenant_name, start_date, end_date, monthly_rent, status, term, intent")
    .eq("unit_id", id)
    .order("start_date", { ascending: false });

  const { data: jobOrders } = await supabase
    .from("job_order")
    .select("id, task_type_id, priority, status, description, cost_estimate, created_at")
    .eq("unit_id", id)
    .order("created_at", { ascending: false });

  // Enrich job orders with task type name
  const taskTypeIds = Array.from(new Set((jobOrders ?? []).map((j: any) => j.task_type_id))).filter(Boolean);
  const { data: taskTypes } = taskTypeIds.length > 0
    ? await supabase.from("job_task_type").select("id, name").in("id", taskTypeIds)
    : { data: [] as { id: string; name: string }[] };
  const taskMap = new Map((taskTypes ?? []).map((t: any) => [t.id, t.name]));

  const { data: assets } = await supabase
    .from("asset")
    .select("id, name, type, install_date, warranty_until")
    .eq("unit_id", id)
    .order("name");

  const leaseRows = (leases ?? []) as any[];
  const activeLease = leaseRows.find((l) => l.status === "active" || l.status === "expiring");

  const enrichedJobs = (jobOrders ?? []).map((j: any) => ({
    ...j,
    task_type_name: taskMap.get(j.task_type_id) ?? null,
  }));

  return {
    unit: {
      ...unit,
      property_name: property?.name ?? null,
      property_address: property?.address ?? null,
    },
    leases: leaseRows,
    jobOrders: enrichedJobs,
    assets: (assets ?? []) as any[],
    stats: {
      current_tenant: activeLease?.tenant_name ?? null,
      lease_status: activeLease?.status ?? null,
      monthly_rent: Number(activeLease?.monthly_rent ?? unit.base_rent ?? 0),
      lease_end: activeLease?.end_date ?? null,
      open_jobs: enrichedJobs.filter((j) => j.status !== "done" && j.status !== "cancelled").length,
      total_assets: (assets ?? []).length,
    },
  };
}
`;

// =============================================================================
// LEASE PROFILE — data
// =============================================================================
FILES["src/lib/db/lease-profile.ts"] =
`import "server-only";
import { createClient } from "@/lib/supabase/server";

export type LeaseProfile = {
  lease: {
    id: string;
    unit_id: string;
    unit_number: string | null;
    property_name: string | null;
    property_address: string | null;
    tenant_id: string;
    tenant_name: string | null;
    tenant_email: string | null;
    tenant_phone: string | null;
    start_date: string;
    end_date: string;
    move_in_date: string | null;
    due_date: string | null;
    intent: string | null;
    term: string | null;
    monthly_rent: number;
    deposit_amount: number;
    deposit_1: number | null;
    deposit_2: number | null;
    ad_ons: unknown;
    ad_ons_amount: number | null;
    notice_period_days: number;
    status: string;
    created_at: string;
  };
  invoices: Array<{
    id: string;
    display_number: string | null;
    type: string;
    amount: number;
    due_date: string;
    status: string;
    created_at: string;
  }>;
  payments: Array<{
    id: string;
    invoice_id: string;
    receipt_number: string | null;
    amount: number;
    method: string;
    paid_at: string;
    invoice_display: string | null;
  }>;
  deposits: Array<{
    id: string;
    amount: number;
    status: string;
    refunded_amount: number;
  }>;
  contract: {
    id: string;
    status: string;
    signed_at: string | null;
    signed_document_url: string | null;
    template_name: string | null;
  } | null;
  activity: Array<{
    id: string;
    action: string;
    entity_type: string;
    entity_id: string;
    created_at: string;
    reason: string | null;
  }>;
  stats: {
    total_invoiced: number;
    total_paid: number;
    outstanding: number;
    days_remaining: number;
    is_expiring_soon: boolean;
  };
};

export async function getLeaseProfile(id: string): Promise<LeaseProfile | null> {
  const supabase = await createClient();

  const { data: lease } = await supabase
    .from("lease")
    .select(
      "id, unit_id, unit_number, tenant_id, tenant_name, start_date, end_date, move_in_date, due_date, intent, term, monthly_rent, deposit_amount, deposit_1, deposit_2, ad_ons, ad_ons_amount, notice_period_days, status, created_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (!lease) return null;

  const { data: unit } = await supabase
    .from("unit")
    .select("id, property_id, unit_number")
    .eq("id", lease.unit_id)
    .maybeSingle();

  const { data: property } = unit
    ? await supabase
        .from("property")
        .select("id, name, address")
        .eq("id", unit.property_id)
        .maybeSingle()
    : { data: null };

  const { data: tenant } = await supabase
    .from("tenant")
    .select("id, full_name, email, phone")
    .eq("id", lease.tenant_id)
    .maybeSingle();

  const { data: invoices } = await supabase
    .from("invoice")
    .select("id, display_number, type, amount, due_date, status, created_at")
    .eq("lease_id", id)
    .order("due_date", { ascending: false });

  const invoiceIds = (invoices ?? []).map((i: any) => i.id);
  const invoiceMap = new Map((invoices ?? []).map((i: any) => [i.id, i]));

  let payments: any[] = [];
  if (invoiceIds.length > 0) {
    const { data } = await supabase
      .from("payment")
      .select("id, invoice_id, receipt_number, amount, method, paid_at")
      .in("invoice_id", invoiceIds)
      .order("paid_at", { ascending: false });
    payments = data ?? [];
  }

  const enrichedPayments = payments.map((p) => ({
    ...p,
    invoice_display: invoiceMap.get(p.invoice_id)?.display_number ?? null,
  }));

  const { data: deposits } = await supabase
    .from("deposit")
    .select("id, amount, status, refunded_amount")
    .eq("lease_id", id);

  const { data: contract } = await supabase
    .from("contract")
    .select("id, status, signed_at, signed_document_url, template_id")
    .eq("lease_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let template_name: string | null = null;
  if (contract?.template_id) {
    const { data: tpl } = await supabase
      .from("contract_template")
      .select("name")
      .eq("id", contract.template_id)
      .maybeSingle();
    template_name = tpl?.name ?? null;
  }

  const entityIds = [id, ...invoiceIds, ...payments.map((p: any) => p.id)];
  const { data: activity } = entityIds.length > 0
    ? await supabase
        .from("audit_log")
        .select("id, action, entity_type, entity_id, created_at, reason")
        .in("entity_id", entityIds)
        .order("created_at", { ascending: false })
        .limit(30)
    : { data: [] as any[] };

  const total_invoiced = (invoices ?? []).reduce((s: number, i: any) => s + Number(i.amount ?? 0), 0);
  const total_paid = payments.reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const outstanding = (invoices ?? [])
    .filter((i: any) => i.status === "unpaid" || i.status === "overdue")
    .reduce((s: number, i: any) => s + Number(i.amount ?? 0), 0);

  const days_remaining = Math.ceil(
    (new Date(lease.end_date).getTime() - Date.now()) / 86400000
  );

  return {
    lease: {
      ...lease,
      property_name: property?.name ?? null,
      property_address: property?.address ?? null,
      tenant_email: tenant?.email ?? null,
      tenant_phone: tenant?.phone ?? null,
    },
    invoices: (invoices ?? []) as any[],
    payments: enrichedPayments,
    deposits: (deposits ?? []) as any[],
    contract: contract
      ? {
          id: contract.id,
          status: contract.status,
          signed_at: contract.signed_at,
          signed_document_url: contract.signed_document_url,
          template_name,
        }
      : null,
    activity: (activity ?? []) as any[],
    stats: {
      total_invoiced,
      total_paid,
      outstanding,
      days_remaining,
      is_expiring_soon: days_remaining <= 30 && days_remaining >= 0,
    },
  };
}
`;

// =============================================================================
// PROPERTY components
// =============================================================================
FILES["src/components/property/profile-header.tsx"] =
`import Link from "next/link";
import { Building2, MapPin, ArrowLeft, Pencil } from "lucide-react";
import { StatusPill } from "@/components/dashboard/status-pill";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { formatPHP } from "@/lib/utils/format-php";
import type { PropertyProfile } from "@/lib/db/property-profile";

const TYPE_TONE: Record<string, "brand" | "purple" | "gray"> = {
  residential: "brand",
  commercial: "purple",
  mixed: "gray",
};

const TYPE_LABEL: Record<string, string> = {
  residential: "Residential",
  commercial: "Commercial",
  mixed: "Mixed",
};

export function PropertyProfileHeader({ profile }: { profile: PropertyProfile }) {
  const { property, stats } = profile;

  return (
    <div className="space-y-6">
      <Link
        href="/property/properties"
        className="inline-flex items-center gap-1.5 text-sm text-ink-500 transition-colors hover:text-ink-800"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All properties
      </Link>

      <div className="flex flex-wrap items-start gap-5 rounded-xl border border-ink-200 bg-surface p-6 dark:border-white/[0.06]">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 text-white shadow-sm">
          <Building2 className="h-7 w-7" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-ink-900">
              {property.name}
            </h1>
            <StatusPill tone={TYPE_TONE[property.type] ?? "gray"}>
              {TYPE_LABEL[property.type] ?? property.type}
            </StatusPill>
          </div>

          {property.address && (
            <div className="mt-3 flex items-center gap-1.5 text-sm text-ink-600">
              <MapPin className="h-3.5 w-3.5 text-ink-400" />
              {property.address}
            </div>
          )}
        </div>

        <Link href={"/property/properties/" + property.id + "/edit"}>
          <Button variant="secondary">
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Edit
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total units" value={stats.total_units} accent="brand" />
        <StatCard label="Occupancy" value={stats.occupancy_pct + "%"} accent="green" deltaLabel={stats.occupied + " occupied"} />
        <StatCard label="Active leases" value={stats.active_leases} accent="purple" />
        <StatCard label="Monthly revenue" value={formatPHP(stats.monthly_revenue)} accent="yellow" />
      </div>
    </div>
  );
}
`;

FILES["src/components/property/tabs/overview-tab.tsx"] =
`import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { formatPHP } from "@/lib/utils/format-php";
import type { PropertyProfile } from "@/lib/db/property-profile";

export function PropertyOverviewTab({ profile }: { profile: PropertyProfile }) {
  const { property, stats } = profile;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader title="Property details" />
        <CardBody className="space-y-3 text-sm">
          <Row label="Name" value={property.name} />
          <Row label="Address" value={property.address ?? "—"} />
          <Row label="Type" value={property.type} />
          <Row label="Total units" value={String(property.total_units)} />
          <Row label="Created" value={new Date(property.created_at).toLocaleDateString("en-PH")} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Occupancy breakdown" />
        <CardBody className="space-y-3 text-sm">
          <Row label="Occupied" value={String(stats.occupied)} />
          <Row label="Vacant" value={String(stats.vacant)} />
          <Row label="Maintenance" value={String(stats.maintenance)} />
          <Row label="Occupancy rate" value={stats.occupancy_pct + "%"} />
          <Row label="Active leases" value={String(stats.active_leases)} />
        </CardBody>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader title="Revenue summary" />
        <CardBody>
          <div className="grid grid-cols-2 gap-6 md:grid-cols-3">
            <Summary label="Monthly revenue" value={formatPHP(stats.monthly_revenue)} />
            <Summary label="Yearly (est.)" value={formatPHP(stats.monthly_revenue * 12)} />
            <Summary label="Average per unit" value={formatPHP(stats.total_units > 0 ? stats.monthly_revenue / stats.total_units : 0)} />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-ink-500">{label}</span>
      <span className="text-right font-medium text-ink-900 capitalize">{value}</span>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-ink-500">{label}</p>
      <p className="mt-0.5 text-base font-semibold text-ink-900">{value}</p>
    </div>
  );
}
`;

FILES["src/components/property/tabs/units-tab.tsx"] =
`import Link from "next/link";
import { DoorOpen } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { StatusPill } from "@/components/dashboard/status-pill";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { formatPHP } from "@/lib/utils/format-php";
import type { PropertyProfile } from "@/lib/db/property-profile";

const STATUS_TONE: Record<string, "green" | "brand" | "yellow" | "red" | "gray"> = {
  vacant: "green",
  occupied: "brand",
  reserved: "yellow",
  maintenance: "red",
  unavailable: "gray",
};

export function PropertyUnitsTab({ profile }: { profile: PropertyProfile }) {
  if (profile.units.length === 0) {
    return (
      <Card>
        <CardBody className="py-16 text-center text-sm text-ink-500">
          No units yet for this property.
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardBody className="p-0">
        <Table>
          <THead>
            <TR>
              <TH>Unit</TH>
              <TH>Layout</TH>
              <TH className="text-right">Rent</TH>
              <TH>Status</TH>
              <TH className="text-right"></TH>
            </TR>
          </THead>
          <TBody>
            {profile.units.map((u) => (
              <TR key={u.id}>
                <TD>
                  <Link href={"/property/units/" + u.id} className="flex items-center gap-3 group">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400">
                      <DoorOpen className="h-4 w-4" />
                    </div>
                    <span className="font-medium text-ink-900 group-hover:text-brand-600 dark:group-hover:text-brand-400">
                      {u.unit_number}
                    </span>
                  </Link>
                </TD>
                <TD className="text-sm text-ink-600">
                  {u.bedrooms != null ? u.bedrooms + "BR" : "—"}
                  {u.area_sqm != null ? " · " + u.area_sqm + " sqm" : ""}
                </TD>
                <TD className="text-right font-medium text-ink-900">
                  {u.base_rent != null ? formatPHP(u.base_rent) : "—"}
                </TD>
                <TD>
                  <StatusPill tone={STATUS_TONE[u.status] ?? "gray"} dot>
                    {u.status}
                  </StatusPill>
                </TD>
                <TD className="text-right">
                  <Link href={"/property/units/" + u.id} className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400">
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

FILES["src/components/property/tabs/leases-tab.tsx"] =
`import Link from "next/link";
import { FileText } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { StatusPill } from "@/components/dashboard/status-pill";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { formatPHP } from "@/lib/utils/format-php";
import type { PropertyProfile } from "@/lib/db/property-profile";

const STATUS_TONE: Record<string, "gray" | "green" | "yellow" | "red" | "brand"> = {
  draft: "gray",
  active: "green",
  expiring: "yellow",
  ended: "brand",
  terminated: "red",
};

export function PropertyLeasesTab({ profile }: { profile: PropertyProfile }) {
  if (profile.leases.length === 0) {
    return (
      <Card>
        <CardBody className="py-16 text-center text-sm text-ink-500">
          No leases yet for this property.
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardBody className="p-0">
        <Table>
          <THead>
            <TR>
              <TH>Lease</TH>
              <TH>Tenant</TH>
              <TH>Dates</TH>
              <TH className="text-right">Rent</TH>
              <TH>Status</TH>
              <TH className="text-right"></TH>
            </TR>
          </THead>
          <TBody>
            {profile.leases.map((l) => (
              <TR key={l.id}>
                <TD>
                  <Link href={"/property/leases/" + l.id} className="flex items-center gap-3 group">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400">
                      <FileText className="h-4 w-4" />
                    </div>
                    <span className="font-medium text-ink-900 group-hover:text-brand-600 dark:group-hover:text-brand-400">
                      Unit {l.unit_number ?? "—"}
                    </span>
                  </Link>
                </TD>
                <TD className="text-ink-600">{l.tenant_name ?? "—"}</TD>
                <TD>
                  <div className="text-xs text-ink-500">
                    {new Date(l.start_date).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "2-digit" })}
                    {" → "}
                    {new Date(l.end_date).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "2-digit" })}
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
                  <Link href={"/property/leases/" + l.id} className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400">
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

FILES["src/components/property/tabs/activity-tab.tsx"] =
`import { Card, CardBody } from "@/components/ui/card";
import { StatusPill } from "@/components/dashboard/status-pill";
import type { PropertyProfile } from "@/lib/db/property-profile";

const ACTION_TONE: Record<string, "green" | "brand" | "red" | "gray"> = {
  create: "green",
  update: "brand",
  delete: "red",
  archive: "gray",
};

export function PropertyActivityTab({ profile }: { profile: PropertyProfile }) {
  if (profile.activity.length === 0) {
    return (
      <Card>
        <CardBody className="py-16 text-center text-sm text-ink-500">
          No activity recorded yet.
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody className="p-0">
        <ul className="divide-y divide-ink-100 dark:divide-white/[0.04]">
          {profile.activity.map((a) => (
            <li key={a.id} className="flex items-start gap-3 px-5 py-3">
              <StatusPill tone={ACTION_TONE[a.action] ?? "gray"}>{a.action}</StatusPill>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-ink-800">
                  <span className="capitalize">{a.action}</span>{" "}
                  <span className="text-ink-500">{a.entity_type.replace("_", " ")}</span>
                </p>
                {a.reason && <p className="mt-0.5 text-xs text-ink-500">{a.reason}</p>}
              </div>
              <span className="shrink-0 text-xs text-ink-400">
                {new Date(a.created_at).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
`;

FILES["src/components/property/property-profile.tsx"] =
`"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { PropertyProfileHeader } from "./profile-header";
import { PropertyOverviewTab } from "./tabs/overview-tab";
import { PropertyUnitsTab } from "./tabs/units-tab";
import { PropertyLeasesTab } from "./tabs/leases-tab";
import { PropertyActivityTab } from "./tabs/activity-tab";
import type { PropertyProfile as Profile } from "@/lib/db/property-profile";

type TabKey = "overview" | "units" | "leases" | "activity";

export function PropertyProfileView({ profile }: { profile: Profile }) {
  const [tab, setTab] = useState<TabKey>("overview");

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: "overview", label: "Overview" },
    { key: "units", label: "Units", count: profile.units.length },
    { key: "leases", label: "Leases", count: profile.leases.length },
    { key: "activity", label: "Activity" },
  ];

  return (
    <div className="space-y-6">
      <PropertyProfileHeader profile={profile} />
      <div>
        <div className="flex flex-wrap gap-1 border-b border-ink-200 dark:border-white/[0.06]">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                tab === t.key
                  ? "border-brand-500 text-brand-600 dark:text-brand-400"
                  : "border-transparent text-ink-500 hover:text-ink-800"
              )}
            >
              {t.label}
              {typeof t.count === "number" && t.count > 0 && (
                <span className="rounded-full bg-ink-100 px-1.5 py-0.5 text-[10px] font-semibold text-ink-500 dark:bg-white/[0.06]">
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="mt-6">
          {tab === "overview" && <PropertyOverviewTab profile={profile} />}
          {tab === "units" && <PropertyUnitsTab profile={profile} />}
          {tab === "leases" && <PropertyLeasesTab profile={profile} />}
          {tab === "activity" && <PropertyActivityTab profile={profile} />}
        </div>
      </div>
    </div>
  );
}
`;

// =============================================================================
// UNIT components
// =============================================================================
FILES["src/components/unit/profile-header.tsx"] =
`import Link from "next/link";
import { DoorOpen, MapPin, ArrowLeft, Pencil } from "lucide-react";
import { StatusPill } from "@/components/dashboard/status-pill";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { formatPHP } from "@/lib/utils/format-php";
import type { UnitProfile } from "@/lib/db/unit-profile";

const STATUS_TONE: Record<string, "green" | "brand" | "yellow" | "red" | "gray"> = {
  vacant: "green",
  occupied: "brand",
  reserved: "yellow",
  maintenance: "red",
  unavailable: "gray",
};

export function UnitProfileHeader({ profile }: { profile: UnitProfile }) {
  const { unit, stats } = profile;

  return (
    <div className="space-y-6">
      <Link
        href="/property/units"
        className="inline-flex items-center gap-1.5 text-sm text-ink-500 transition-colors hover:text-ink-800"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All units
      </Link>

      <div className="flex flex-wrap items-start gap-5 rounded-xl border border-ink-200 bg-surface p-6 dark:border-white/[0.06]">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 text-white shadow-sm">
          <DoorOpen className="h-7 w-7" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-ink-900">
              Unit {unit.unit_number}
            </h1>
            <StatusPill tone={STATUS_TONE[unit.status] ?? "gray"} dot>
              {unit.status}
            </StatusPill>
          </div>

          {unit.property_name && (
            <div className="mt-3 flex items-center gap-1.5 text-sm text-ink-600">
              <MapPin className="h-3.5 w-3.5 text-ink-400" />
              <Link
                href={"/property/properties/" + unit.property_id}
                className="hover:text-brand-600 hover:underline dark:hover:text-brand-400"
              >
                {unit.property_name}
              </Link>
              {unit.property_address && <span>· {unit.property_address}</span>}
            </div>
          )}
        </div>

        <Link href={"/property/units/" + unit.id + "/edit"}>
          <Button variant="secondary">
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Edit
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Current tenant"
          value={stats.current_tenant ?? "Vacant"}
          accent="brand"
        />
        <StatCard
          label="Monthly rent"
          value={formatPHP(stats.monthly_rent)}
          accent="green"
        />
        <StatCard
          label="Open job orders"
          value={stats.open_jobs}
          accent={stats.open_jobs > 0 ? "yellow" : "purple"}
        />
        <StatCard
          label="Assets tracked"
          value={stats.total_assets}
          accent="purple"
        />
      </div>
    </div>
  );
}
`;

FILES["src/components/unit/tabs/overview-tab.tsx"] =
`import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusPill } from "@/components/dashboard/status-pill";
import { formatPHP } from "@/lib/utils/format-php";
import type { UnitProfile } from "@/lib/db/unit-profile";

export function UnitOverviewTab({ profile }: { profile: UnitProfile }) {
  const { unit, stats } = profile;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader title="Unit details" />
        <CardBody className="space-y-3 text-sm">
          <Row label="Unit number" value={unit.unit_number} />
          <Row label="Property" value={unit.property_name ?? "—"} />
          <Row label="Floor" value={unit.floor != null ? String(unit.floor) : "—"} />
          <Row label="Bedrooms" value={unit.bedrooms != null ? String(unit.bedrooms) : "—"} />
          <Row label="Bathrooms" value={unit.bathrooms != null ? String(unit.bathrooms) : "—"} />
          <Row label="Area" value={unit.area_sqm != null ? unit.area_sqm + " sqm" : "—"} />
          <Row label="Base rent" value={unit.base_rent != null ? formatPHP(unit.base_rent) : "—"} />
          <Row
            label="Status"
            value={<StatusPill tone={unit.status === "vacant" ? "green" : unit.status === "occupied" ? "brand" : "gray"} dot>{unit.status}</StatusPill>}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Current occupancy" />
        <CardBody className="text-sm">
          {stats.current_tenant ? (
            <div className="space-y-3">
              <Row label="Tenant" value={stats.current_tenant} />
              <Row label="Monthly rent" value={formatPHP(stats.monthly_rent)} />
              <Row label="Lease status" value={stats.lease_status ?? "—"} />
              {stats.lease_end && (
                <Row label="Lease ends" value={new Date(stats.lease_end).toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" })} />
              )}
            </div>
          ) : (
            <p className="py-8 text-center text-ink-500">Unit is currently vacant.</p>
          )}
        </CardBody>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader title="Quick facts" />
        <CardBody>
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            <Summary label="Total leases" value={String(profile.leases.length)} />
            <Summary label="Job orders" value={String(profile.jobOrders.length)} />
            <Summary label="Assets" value={String(profile.assets.length)} />
            <Summary label="Days since creation" value={String(Math.max(0, Math.ceil((Date.now() - new Date(unit.created_at).getTime()) / 86400000)))} />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-ink-500">{label}</span>
      <span className="text-right font-medium text-ink-900 capitalize">{value}</span>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-ink-500">{label}</p>
      <p className="mt-0.5 text-base font-semibold text-ink-900">{value}</p>
    </div>
  );
}
`;

FILES["src/components/unit/tabs/lease-history-tab.tsx"] =
`import Link from "next/link";
import { FileText } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { StatusPill } from "@/components/dashboard/status-pill";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { formatPHP } from "@/lib/utils/format-php";
import type { UnitProfile } from "@/lib/db/unit-profile";

const STATUS_TONE: Record<string, "gray" | "green" | "yellow" | "red" | "brand"> = {
  draft: "gray",
  active: "green",
  expiring: "yellow",
  ended: "brand",
  terminated: "red",
};

export function UnitLeaseHistoryTab({ profile }: { profile: UnitProfile }) {
  if (profile.leases.length === 0) {
    return (
      <Card>
        <CardBody className="py-16 text-center text-sm text-ink-500">
          No leases on file for this unit.
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardBody className="p-0">
        <Table>
          <THead>
            <TR>
              <TH>Tenant</TH>
              <TH>Dates</TH>
              <TH className="text-right">Rent</TH>
              <TH>Status</TH>
              <TH className="text-right"></TH>
            </TR>
          </THead>
          <TBody>
            {profile.leases.map((l) => (
              <TR key={l.id}>
                <TD>
                  <Link href={"/property/leases/" + l.id} className="flex items-center gap-3 group">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400">
                      <FileText className="h-4 w-4" />
                    </div>
                    <span className="font-medium text-ink-900 group-hover:text-brand-600 dark:group-hover:text-brand-400">
                      {l.tenant_name ?? "—"}
                    </span>
                  </Link>
                </TD>
                <TD>
                  <div className="text-xs text-ink-500">
                    {new Date(l.start_date).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "2-digit" })}
                    {" → "}
                    {new Date(l.end_date).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "2-digit" })}
                  </div>
                </TD>
                <TD className="text-right font-medium text-ink-900">{formatPHP(l.monthly_rent)}</TD>
                <TD>
                  <StatusPill tone={STATUS_TONE[l.status] ?? "gray"} dot>
                    {l.status}
                  </StatusPill>
                </TD>
                <TD className="text-right">
                  <Link href={"/property/leases/" + l.id} className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400">
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

FILES["src/components/unit/tabs/job-orders-tab.tsx"] =
`import Link from "next/link";
import { Wrench } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { StatusPill } from "@/components/dashboard/status-pill";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { formatPHP } from "@/lib/utils/format-php";
import type { UnitProfile } from "@/lib/db/unit-profile";

const STATUS_TONE: Record<string, "gray" | "yellow" | "brand" | "green" | "red" | "purple"> = {
  open: "gray",
  pending_approval: "yellow",
  assigned: "brand",
  in_progress: "purple",
  done: "green",
  cancelled: "red",
};

export function UnitJobOrdersTab({ profile }: { profile: UnitProfile }) {
  if (profile.jobOrders.length === 0) {
    return (
      <Card>
        <CardBody className="py-16 text-center text-sm text-ink-500">
          No job orders for this unit.
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardBody className="p-0">
        <Table>
          <THead>
            <TR>
              <TH>Task</TH>
              <TH>Priority</TH>
              <TH className="text-right">Cost</TH>
              <TH>Status</TH>
              <TH className="text-right"></TH>
            </TR>
          </THead>
          <TBody>
            {profile.jobOrders.map((j) => (
              <TR key={j.id}>
                <TD>
                  <Link href={"/maintenance/job-orders/" + j.id} className="flex items-center gap-3 group">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400">
                      <Wrench className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink-900 group-hover:text-brand-600 dark:group-hover:text-brand-400">
                        {j.task_type_name ?? "Task"}
                      </p>
                      {j.description && (
                        <p className="truncate text-xs text-ink-500 max-w-xs">{j.description}</p>
                      )}
                    </div>
                  </Link>
                </TD>
                <TD className="text-sm capitalize text-ink-600">{j.priority}</TD>
                <TD className="text-right font-medium text-ink-900">
                  {j.cost_estimate != null ? formatPHP(j.cost_estimate) : "—"}
                </TD>
                <TD>
                  <StatusPill tone={STATUS_TONE[j.status] ?? "gray"} dot>
                    {j.status.replace("_", " ")}
                  </StatusPill>
                </TD>
                <TD className="text-right">
                  <Link href={"/maintenance/job-orders/" + j.id} className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400">
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

FILES["src/components/unit/tabs/assets-tab.tsx"] =
`import Link from "next/link";
import { Package } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { StatusPill } from "@/components/dashboard/status-pill";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import type { UnitProfile } from "@/lib/db/unit-profile";

export function UnitAssetsTab({ profile }: { profile: UnitProfile }) {
  const now = new Date();

  if (profile.assets.length === 0) {
    return (
      <Card>
        <CardBody className="py-16 text-center text-sm text-ink-500">
          No assets tracked for this unit.
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardBody className="p-0">
        <Table>
          <THead>
            <TR>
              <TH>Asset</TH>
              <TH>Type</TH>
              <TH>Installed</TH>
              <TH>Warranty until</TH>
              <TH>Status</TH>
              <TH className="text-right"></TH>
            </TR>
          </THead>
          <TBody>
            {profile.assets.map((a) => {
              const inW = a.warranty_until && new Date(a.warranty_until) >= now;
              return (
                <TR key={a.id}>
                  <TD>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400">
                        <Package className="h-4 w-4" />
                      </div>
                      <span className="font-medium text-ink-900">{a.name}</span>
                    </div>
                  </TD>
                  <TD className="text-sm text-ink-600">{a.type ?? "—"}</TD>
                  <TD className="text-sm text-ink-500">
                    {a.install_date ? new Date(a.install_date).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                  </TD>
                  <TD className="text-sm text-ink-500">
                    {a.warranty_until ? new Date(a.warranty_until).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                  </TD>
                  <TD>
                    {a.warranty_until ? (
                      <StatusPill tone={inW ? "green" : "yellow"} dot>
                        {inW ? "in warranty" : "expired"}
                      </StatusPill>
                    ) : (
                      <StatusPill tone="gray">unknown</StatusPill>
                    )}
                  </TD>
                  <TD className="text-right">
                    <Link href={"/maintenance/assets/" + a.id} className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400">
                      View
                    </Link>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </CardBody>
    </Card>
  );
}
`;

FILES["src/components/unit/unit-profile.tsx"] =
`"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { UnitProfileHeader } from "./profile-header";
import { UnitOverviewTab } from "./tabs/overview-tab";
import { UnitLeaseHistoryTab } from "./tabs/lease-history-tab";
import { UnitJobOrdersTab } from "./tabs/job-orders-tab";
import { UnitAssetsTab } from "./tabs/assets-tab";
import type { UnitProfile as Profile } from "@/lib/db/unit-profile";

type TabKey = "overview" | "leases" | "jobs" | "assets";

export function UnitProfileView({ profile }: { profile: Profile }) {
  const [tab, setTab] = useState<TabKey>("overview");

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: "overview", label: "Overview" },
    { key: "leases", label: "Lease history", count: profile.leases.length },
    { key: "jobs", label: "Job orders", count: profile.jobOrders.length },
    { key: "assets", label: "Assets", count: profile.assets.length },
  ];

  return (
    <div className="space-y-6">
      <UnitProfileHeader profile={profile} />
      <div>
        <div className="flex flex-wrap gap-1 border-b border-ink-200 dark:border-white/[0.06]">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                tab === t.key
                  ? "border-brand-500 text-brand-600 dark:text-brand-400"
                  : "border-transparent text-ink-500 hover:text-ink-800"
              )}
            >
              {t.label}
              {typeof t.count === "number" && t.count > 0 && (
                <span className="rounded-full bg-ink-100 px-1.5 py-0.5 text-[10px] font-semibold text-ink-500 dark:bg-white/[0.06]">
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="mt-6">
          {tab === "overview" && <UnitOverviewTab profile={profile} />}
          {tab === "leases" && <UnitLeaseHistoryTab profile={profile} />}
          {tab === "jobs" && <UnitJobOrdersTab profile={profile} />}
          {tab === "assets" && <UnitAssetsTab profile={profile} />}
        </div>
      </div>
    </div>
  );
}
`;

// =============================================================================
// LEASE components
// =============================================================================
FILES["src/components/lease/profile-header.tsx"] =
`import Link from "next/link";
import { FileText, ArrowLeft, Pencil, AlertTriangle } from "lucide-react";
import { StatusPill } from "@/components/dashboard/status-pill";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { formatPHP } from "@/lib/utils/format-php";
import type { LeaseProfile } from "@/lib/db/lease-profile";

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

export function LeaseProfileHeader({ profile }: { profile: LeaseProfile }) {
  const { lease, stats } = profile;

  return (
    <div className="space-y-6">
      <Link
        href="/property/leases"
        className="inline-flex items-center gap-1.5 text-sm text-ink-500 transition-colors hover:text-ink-800"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All leases
      </Link>

      <div className="flex flex-wrap items-start gap-5 rounded-xl border border-ink-200 bg-surface p-6 dark:border-white/[0.06]">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 text-white shadow-sm">
          <FileText className="h-7 w-7" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-ink-900">
              Lease — Unit {lease.unit_number ?? "—"}
            </h1>
            <StatusPill tone={STATUS_TONE[lease.status] ?? "gray"} dot>
              {lease.status}
            </StatusPill>
            {stats.is_expiring_soon && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-100 px-2.5 py-0.5 text-xs font-medium text-warning-700 dark:bg-warning-500/15 dark:text-warning-500">
                <AlertTriangle className="h-3 w-3" />
                Expiring in {stats.days_remaining}d
              </span>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-600">
            {lease.tenant_name && (
              <Link
                href={"/property/tenants/" + lease.tenant_id}
                className="hover:text-brand-600 hover:underline dark:hover:text-brand-400"
              >
                {lease.tenant_name}
              </Link>
            )}
            {lease.property_name && <span>· {lease.property_name}</span>}
            {lease.term && <span>· {TERM_LABEL[lease.term] ?? lease.term}</span>}
          </div>
        </div>

        <Link href={"/property/leases/" + lease.id + "/edit"}>
          <Button variant="secondary">
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Edit
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Monthly rent" value={formatPHP(lease.monthly_rent)} accent="brand" />
        <StatCard label="Total invoiced" value={formatPHP(stats.total_invoiced)} accent="yellow" />
        <StatCard label="Total paid" value={formatPHP(stats.total_paid)} accent="green" />
        <StatCard
          label="Outstanding"
          value={formatPHP(stats.outstanding)}
          accent={stats.outstanding > 0 ? "red" : "purple"}
        />
      </div>
    </div>
  );
}
`;

FILES["src/components/lease/tabs/overview-tab.tsx"] =
`import Link from "next/link";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusPill } from "@/components/dashboard/status-pill";
import { Button } from "@/components/ui/button";
import { formatPHP } from "@/lib/utils/format-php";
import type { LeaseProfile } from "@/lib/db/lease-profile";

const TERM_LABEL: Record<string, string> = {
  "1_month": "1 month",
  "3_months": "3 months",
  "6_months": "6 months",
  "1_year": "1 year",
  "2_years": "2 years",
  "3_years": "3 years",
  other: "Other",
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function adOnsList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x: any) => (typeof x === "string" ? x : x.text ?? "")).filter(Boolean);
}

export function LeaseOverviewTab({ profile }: { profile: LeaseProfile }) {
  const { lease, contract, stats } = profile;
  const adOns = adOnsList(lease.ad_ons);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader title="Tenant" />
        <CardBody className="space-y-3 text-sm">
          <Row label="Name" value={
            <Link href={"/property/tenants/" + lease.tenant_id} className="text-brand-600 hover:underline dark:text-brand-400">
              {lease.tenant_name ?? "—"}
            </Link>
          } />
          <Row label="Email" value={lease.tenant_email ?? "—"} />
          <Row label="Phone" value={lease.tenant_phone ?? "—"} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Unit & property" />
        <CardBody className="space-y-3 text-sm">
          <Row label="Unit" value={
            <Link href={"/property/units/" + lease.unit_id} className="text-brand-600 hover:underline dark:text-brand-400">
              {lease.unit_number ?? "—"}
            </Link>
          } />
          <Row label="Property" value={lease.property_name ?? "—"} />
          <Row label="Address" value={lease.property_address ?? "—"} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Terms" />
        <CardBody className="space-y-3 text-sm">
          <Row label="Term" value={lease.term ? (TERM_LABEL[lease.term] ?? lease.term) : "—"} />
          <Row label="Intent" value={lease.intent ?? "—"} />
          <Row label="Start date" value={formatDate(lease.start_date)} />
          <Row label="End of contract" value={formatDate(lease.end_date)} />
          {lease.move_in_date && <Row label="Move-in date" value={formatDate(lease.move_in_date)} />}
          {lease.due_date && <Row label="Rent due date" value={formatDate(lease.due_date)} />}
          <Row label="Notice period" value={lease.notice_period_days + " days"} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Financials" />
        <CardBody className="space-y-3 text-sm">
          <Row label="Monthly rent" value={formatPHP(lease.monthly_rent)} />
          <Row label="1st deposit" value={formatPHP(lease.deposit_1 ?? 0)} />
          <Row label="2nd deposit" value={formatPHP(lease.deposit_2 ?? 0)} />
          <Row label="Add-ons amount" value={formatPHP(lease.ad_ons_amount ?? 0)} />
          {adOns.length > 0 && (
            <div>
              <p className="text-ink-500">Add-ons</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {adOns.map((a, i) => (
                  <StatusPill key={i} tone="brand">{a}</StatusPill>
                ))}
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader
          title="Contract"
          action={
            contract ? (
              <Link href={"/property/contracts/" + contract.id}>
                <Button variant="secondary" size="sm">View contract</Button>
              </Link>
            ) : undefined
          }
        />
        <CardBody className="text-sm">
          {contract ? (
            <div className="space-y-3">
              <Row label="Template" value={contract.template_name ?? "—"} />
              <Row
                label="Status"
                value={<StatusPill tone={contract.status === "signed" ? "green" : "yellow"} dot>{contract.status}</StatusPill>}
              />
              {contract.signed_at && <Row label="Signed at" value={formatDate(contract.signed_at)} />}
              {contract.signed_document_url && (
                <Row
                  label="Document"
                  value={
                    <a href={contract.signed_document_url} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline dark:text-brand-400">
                      Open signed document →
                    </a>
                  }
                />
              )}
            </div>
          ) : (
            <div className="py-6 text-center">
              <p className="text-ink-500 mb-3">No contract generated for this lease yet.</p>
              <Link href="/property/contracts/new">
                <Button size="sm">Generate contract</Button>
              </Link>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-ink-500">{label}</span>
      <span className="text-right font-medium text-ink-900 capitalize">{value}</span>
    </div>
  );
}
`;

FILES["src/components/lease/tabs/invoices-tab.tsx"] =
`import Link from "next/link";
import { Receipt } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { StatusPill } from "@/components/dashboard/status-pill";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { formatPHP } from "@/lib/utils/format-php";
import type { LeaseProfile } from "@/lib/db/lease-profile";

const STATUS_TONE: Record<string, "gray" | "green" | "yellow" | "red"> = {
  unpaid: "yellow",
  paid: "green",
  overdue: "red",
  void: "gray",
};

const TYPE_LABEL: Record<string, string> = {
  rent: "Rent",
  deposit: "Deposit",
  penalty: "Penalty",
  other: "Other",
};

export function LeaseInvoicesTab({ profile }: { profile: LeaseProfile }) {
  if (profile.invoices.length === 0) {
    return (
      <Card>
        <CardBody className="py-16 text-center text-sm text-ink-500">
          No invoices for this lease yet.
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardBody className="p-0">
        <Table>
          <THead>
            <TR>
              <TH>Invoice</TH>
              <TH>Type</TH>
              <TH>Due</TH>
              <TH className="text-right">Amount</TH>
              <TH>Status</TH>
              <TH className="text-right"></TH>
            </TR>
          </THead>
          <TBody>
            {profile.invoices.map((inv) => (
              <TR key={inv.id}>
                <TD>
                  <Link href={"/accounting/invoices/" + inv.id} className="flex items-center gap-3 group">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400">
                      <Receipt className="h-4 w-4" />
                    </div>
                    <span className="font-medium text-ink-900 group-hover:text-brand-600 dark:group-hover:text-brand-400">
                      {inv.display_number ?? inv.id.slice(0, 8)}
                    </span>
                  </Link>
                </TD>
                <TD className="text-sm text-ink-600">{TYPE_LABEL[inv.type] ?? inv.type}</TD>
                <TD className="text-sm text-ink-600">
                  {new Date(inv.due_date).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                </TD>
                <TD className="text-right font-medium text-ink-900">{formatPHP(inv.amount)}</TD>
                <TD>
                  <StatusPill tone={STATUS_TONE[inv.status] ?? "gray"} dot>{inv.status}</StatusPill>
                </TD>
                <TD className="text-right">
                  <Link href={"/accounting/invoices/" + inv.id} className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400">
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

FILES["src/components/lease/tabs/payments-tab.tsx"] =
`import Link from "next/link";
import { Receipt } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { formatPHP } from "@/lib/utils/format-php";
import type { LeaseProfile } from "@/lib/db/lease-profile";

export function LeasePaymentsTab({ profile }: { profile: LeaseProfile }) {
  if (profile.payments.length === 0) {
    return (
      <Card>
        <CardBody className="py-16 text-center text-sm text-ink-500">
          No payments recorded for this lease yet.
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardBody className="p-0">
        <Table>
          <THead>
            <TR>
              <TH>Receipt</TH>
              <TH>Invoice</TH>
              <TH>Method</TH>
              <TH>Paid at</TH>
              <TH className="text-right">Amount</TH>
              <TH className="text-right"></TH>
            </TR>
          </THead>
          <TBody>
            {profile.payments.map((p) => (
              <TR key={p.id}>
                <TD>
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-success-500/10 text-success-700 dark:text-success-500">
                      <Receipt className="h-3.5 w-3.5" />
                    </div>
                    <span className="font-medium text-ink-900">{p.receipt_number ?? "—"}</span>
                  </div>
                </TD>
                <TD className="text-sm text-ink-600">{p.invoice_display ?? "—"}</TD>
                <TD className="text-sm text-ink-600 capitalize">{p.method.replace("_", " ")}</TD>
                <TD className="text-sm text-ink-600">
                  {new Date(p.paid_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                </TD>
                <TD className="text-right font-medium text-success-700 dark:text-success-500">
                  {formatPHP(p.amount)}
                </TD>
                <TD className="text-right">
                  <Link href={"/accounting/payments/" + p.id + "/receipt"} className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400">
                    Receipt
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

FILES["src/components/lease/tabs/deposits-tab.tsx"] =
`import Link from "next/link";
import { Wallet } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { StatusPill } from "@/components/dashboard/status-pill";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { formatPHP } from "@/lib/utils/format-php";
import type { LeaseProfile } from "@/lib/db/lease-profile";

const STATUS_TONE: Record<string, "yellow" | "brand" | "green" | "red"> = {
  held: "yellow",
  partial: "brand",
  returned: "green",
  forfeited: "red",
};

export function LeaseDepositsTab({ profile }: { profile: LeaseProfile }) {
  if (profile.deposits.length === 0) {
    return (
      <Card>
        <CardBody className="py-16 text-center text-sm text-ink-500">
          No deposits recorded for this lease.
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardBody className="p-0">
        <Table>
          <THead>
            <TR>
              <TH>Amount held</TH>
              <TH>Refunded</TH>
              <TH>Status</TH>
              <TH className="text-right"></TH>
            </TR>
          </THead>
          <TBody>
            {profile.deposits.map((d) => (
              <TR key={d.id}>
                <TD>
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-warning-500/10 text-warning-700 dark:text-warning-500">
                      <Wallet className="h-3.5 w-3.5" />
                    </div>
                    <span className="font-medium text-ink-900">{formatPHP(d.amount)}</span>
                  </div>
                </TD>
                <TD className="text-sm text-ink-600">{formatPHP(d.refunded_amount)}</TD>
                <TD>
                  <StatusPill tone={STATUS_TONE[d.status] ?? "gray"} dot>{d.status}</StatusPill>
                </TD>
                <TD className="text-right">
                  <Link href="/accounting/deposits" className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400">
                    Manage
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

FILES["src/components/lease/tabs/activity-tab.tsx"] =
`import { Card, CardBody } from "@/components/ui/card";
import { StatusPill } from "@/components/dashboard/status-pill";
import type { LeaseProfile } from "@/lib/db/lease-profile";

const ACTION_TONE: Record<string, "green" | "brand" | "red" | "gray"> = {
  create: "green",
  update: "brand",
  delete: "red",
  archive: "gray",
};

export function LeaseActivityTab({ profile }: { profile: LeaseProfile }) {
  if (profile.activity.length === 0) {
    return (
      <Card>
        <CardBody className="py-16 text-center text-sm text-ink-500">
          No activity recorded yet.
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody className="p-0">
        <ul className="divide-y divide-ink-100 dark:divide-white/[0.04]">
          {profile.activity.map((a) => (
            <li key={a.id} className="flex items-start gap-3 px-5 py-3">
              <StatusPill tone={ACTION_TONE[a.action] ?? "gray"}>{a.action}</StatusPill>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-ink-800">
                  <span className="capitalize">{a.action}</span>{" "}
                  <span className="text-ink-500">{a.entity_type.replace("_", " ")}</span>
                </p>
                {a.reason && <p className="mt-0.5 text-xs text-ink-500">{a.reason}</p>}
              </div>
              <span className="shrink-0 text-xs text-ink-400">
                {new Date(a.created_at).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
`;

FILES["src/components/lease/lease-profile.tsx"] =
`"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { LeaseProfileHeader } from "./profile-header";
import { LeaseOverviewTab } from "./tabs/overview-tab";
import { LeaseInvoicesTab } from "./tabs/invoices-tab";
import { LeasePaymentsTab } from "./tabs/payments-tab";
import { LeaseDepositsTab } from "./tabs/deposits-tab";
import { LeaseActivityTab } from "./tabs/activity-tab";
import type { LeaseProfile as Profile } from "@/lib/db/lease-profile";

type TabKey = "overview" | "invoices" | "payments" | "deposits" | "activity";

export function LeaseProfileView({ profile }: { profile: Profile }) {
  const [tab, setTab] = useState<TabKey>("overview");

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: "overview", label: "Overview" },
    { key: "invoices", label: "Invoices", count: profile.invoices.length },
    { key: "payments", label: "Payments", count: profile.payments.length },
    { key: "deposits", label: "Deposits", count: profile.deposits.length },
    { key: "activity", label: "Activity" },
  ];

  return (
    <div className="space-y-6">
      <LeaseProfileHeader profile={profile} />
      <div>
        <div className="flex flex-wrap gap-1 border-b border-ink-200 dark:border-white/[0.06]">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                tab === t.key
                  ? "border-brand-500 text-brand-600 dark:text-brand-400"
                  : "border-transparent text-ink-500 hover:text-ink-800"
              )}
            >
              {t.label}
              {typeof t.count === "number" && t.count > 0 && (
                <span className="rounded-full bg-ink-100 px-1.5 py-0.5 text-[10px] font-semibold text-ink-500 dark:bg-white/[0.06]">
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="mt-6">
          {tab === "overview" && <LeaseOverviewTab profile={profile} />}
          {tab === "invoices" && <LeaseInvoicesTab profile={profile} />}
          {tab === "payments" && <LeasePaymentsTab profile={profile} />}
          {tab === "deposits" && <LeaseDepositsTab profile={profile} />}
          {tab === "activity" && <LeaseActivityTab profile={profile} />}
        </div>
      </div>
    </div>
  );
}
`;

// =============================================================================
// Page updates
// =============================================================================
FILES["src/app/(dashboard)/property/properties/[id]/page.tsx"] =
`import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/guard";
import { getPropertyProfile } from "@/lib/db/property-profile";
import { PropertyProfileView } from "@/components/property/property-profile";

export default async function PropertyProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("property:read");
  const { id } = await params;

  const profile = await getPropertyProfile(id);
  if (!profile) notFound();

  return <PropertyProfileView profile={profile} />;
}
`;

FILES["src/app/(dashboard)/property/properties/[id]/edit/page.tsx"] =
`import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/guard";
import { getProperty } from "@/lib/db/properties";
import { PageHeader } from "@/components/layout/page-header";
import { PropertyForm } from "@/components/property/property-form";
import { ArchivePropertyButton } from "@/components/property/archive-property-button";

export default async function EditPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("property:read");
  const { id } = await params;
  const property = await getProperty(id);
  if (!property) notFound();

  return (
    <div>
      <Link
        href={"/property/properties/" + id}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-ink-500 transition-colors hover:text-ink-800"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to profile
      </Link>
      <PageHeader
        title={property.name}
        description="Edit property details"
        action={<ArchivePropertyButton id={property.id} />}
      />
      <PropertyForm mode="edit" property={property} />
    </div>
  );
}
`;

FILES["src/app/(dashboard)/property/units/[id]/page.tsx"] =
`import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/guard";
import { getUnitProfile } from "@/lib/db/unit-profile";
import { UnitProfileView } from "@/components/unit/unit-profile";

export default async function UnitProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("unit:read");
  const { id } = await params;

  const profile = await getUnitProfile(id);
  if (!profile) notFound();

  return <UnitProfileView profile={profile} />;
}
`;

FILES["src/app/(dashboard)/property/units/[id]/edit/page.tsx"] =
`import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/guard";
import { getUnit } from "@/lib/db/units";
import { listProperties } from "@/lib/db/properties";
import { PageHeader } from "@/components/layout/page-header";
import { UnitForm } from "@/components/unit/unit-form";

export default async function EditUnitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("unit:read");
  const { id } = await params;
  const unit = await getUnit(id);
  if (!unit) notFound();

  const properties = await listProperties();

  return (
    <div>
      <Link
        href={"/property/units/" + id}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-ink-500 transition-colors hover:text-ink-800"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to profile
      </Link>
      <PageHeader
        title={"Edit Unit " + unit.unit_number}
        description={unit.property_name ?? ""}
      />
      <UnitForm mode="edit" unit={unit} properties={properties} />
    </div>
  );
}
`;

FILES["src/app/(dashboard)/property/leases/[id]/page.tsx"] =
`import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/guard";
import { getLeaseProfile } from "@/lib/db/lease-profile";
import { LeaseProfileView } from "@/components/lease/lease-profile";

export default async function LeaseProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("lease:read");
  const { id } = await params;

  const profile = await getLeaseProfile(id);
  if (!profile) notFound();

  return <LeaseProfileView profile={profile} />;
}
`;

FILES["src/app/(dashboard)/property/leases/[id]/edit/page.tsx"] =
`import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/guard";
import { getLease } from "@/lib/db/leases";
import { listUnits } from "@/lib/db/units";
import { listTenants } from "@/lib/db/tenants";
import { listProperties } from "@/lib/db/properties";
import { PageHeader } from "@/components/layout/page-header";
import { LeaseForm } from "@/components/lease/lease-form";

export default async function EditLeasePage({
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
      <Link
        href={"/property/leases/" + id}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-ink-500 transition-colors hover:text-ink-800"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to profile
      </Link>
      <PageHeader title={"Edit Lease — Unit " + (lease.unit_number ?? "")} />
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

  console.log("Property / Unit / Lease profile pages\\n");

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
  console.log("\\nNew routes:");
  console.log("  /property/properties/[id]        — Property profile");
  console.log("  /property/properties/[id]/edit   — Property edit form");
  console.log("  /property/units/[id]             — Unit profile");
  console.log("  /property/units/[id]/edit        — Unit edit form");
  console.log("  /property/leases/[id]            — Lease profile");
  console.log("  /property/leases/[id]/edit       — Lease edit form");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});