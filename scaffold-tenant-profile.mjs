#!/usr/bin/env node
/**
 * Tenant Profile Page
 * Usage: node scaffold-tenant-profile.mjs
 *
 * Creates:
 *   src/lib/db/tenant-profile.ts
 *   src/components/tenant/profile-header.tsx
 *   src/components/tenant/tabs/overview-tab.tsx
 *   src/components/tenant/tabs/leases-tab.tsx
 *   src/components/tenant/tabs/invoices-tab.tsx
 *   src/components/tenant/tabs/payments-tab.tsx
 *   src/components/tenant/tabs/deposits-tab.tsx
 *   src/components/tenant/tabs/ledger-tab.tsx
 *   src/components/tenant/tabs/activity-tab.tsx
 *   src/components/tenant/tenant-profile.tsx
 *
 * Updates:
 *   src/app/(dashboard)/property/tenants/[id]/page.tsx   (profile layout)
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
// 1. Profile aggregation
// =============================================================================
FILES["src/lib/db/tenant-profile.ts"] =
`import "server-only";
import { createClient } from "@/lib/supabase/server";

export type TenantProfile = {
  tenant: {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    messenger_name: string | null;
    government_id: string | null;
    status: string;
    created_at: string;
  };
  leases: Array<{
    id: string;
    unit_id: string;
    unit_number: string | null;
    property_name: string | null;
    start_date: string;
    end_date: string;
    monthly_rent: number;
    deposit_amount: number;
    status: string;
    term: string | null;
    intent: string | null;
    move_in_date: string | null;
    due_date: string | null;
  }>;
  invoices: Array<{
    id: string;
    lease_id: string;
    display_number: string | null;
    type: string;
    amount: number;
    due_date: string;
    status: string;
    created_at: string;
    unit_number: string | null;
  }>;
  payments: Array<{
    id: string;
    invoice_id: string;
    receipt_number: string | null;
    amount: number;
    method: string;
    reference_no: string | null;
    paid_at: string;
    invoice_display: string | null;
  }>;
  deposits: Array<{
    id: string;
    lease_id: string;
    amount: number;
    status: string;
    refunded_amount: number;
    unit_number: string | null;
  }>;
  ledger: Array<{
    id: string;
    type: string;
    amount: number;
    balance_after: number;
    ref_invoice_id: string | null;
    created_at: string;
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
    total_invoiced: number;
    total_paid: number;
    outstanding: number;
    overdue_count: number;
    current_balance: number;
    active_leases: number;
    deposit_held: number;
  };
};

export async function getTenantProfile(tenant_id: string): Promise<TenantProfile | null> {
  const supabase = await createClient();

  // Tenant
  const { data: tenant } = await supabase
    .from("tenant")
    .select("id, full_name, email, phone, messenger_name, government_id, status, created_at")
    .eq("id", tenant_id)
    .maybeSingle();

  if (!tenant) return null;

  // Leases
  const { data: leases } = await supabase
    .from("lease")
    .select(
      "id, unit_id, unit_number, start_date, end_date, monthly_rent, deposit_amount, status, term, intent, move_in_date, due_date"
    )
    .eq("tenant_id", tenant_id)
    .order("start_date", { ascending: false });

  const leaseRows = (leases ?? []) as any[];
  const leaseIds = leaseRows.map((l) => l.id);
  const unitIds = Array.from(new Set(leaseRows.map((l) => l.unit_id))).filter(Boolean);

  // Property info for those units
  let unitMap = new Map<string, { unit_number: string; property_name: string }>();
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
      unitMap.set(u.id, {
        unit_number: u.unit_number,
        property_name: propMap.get(u.property_id) ?? "",
      });
    }
  }

  const enrichedLeases = leaseRows.map((l) => ({
    ...l,
    property_name: unitMap.get(l.unit_id)?.property_name ?? null,
    unit_number: l.unit_number ?? unitMap.get(l.unit_id)?.unit_number ?? null,
  }));

  // Invoices
  let invoices: any[] = [];
  if (leaseIds.length > 0) {
    const { data } = await supabase
      .from("invoice")
      .select("id, lease_id, display_number, type, amount, due_date, status, created_at")
      .in("lease_id", leaseIds)
      .order("due_date", { ascending: false });
    invoices = data ?? [];
  }

  const invoiceIds = invoices.map((i) => i.id);
  const invoiceMap = new Map(invoices.map((i) => [i.id, i]));
  const leaseToUnit = new Map(leaseRows.map((l) => [l.id, l.unit_id]));

  const enrichedInvoices = invoices.map((inv) => ({
    ...inv,
    unit_number: unitMap.get(leaseToUnit.get(inv.lease_id) ?? "")?.unit_number ?? null,
  }));

  // Payments
  let payments: any[] = [];
  if (invoiceIds.length > 0) {
    const { data } = await supabase
      .from("payment")
      .select("id, invoice_id, receipt_number, amount, method, reference_no, paid_at")
      .in("invoice_id", invoiceIds)
      .order("paid_at", { ascending: false });
    payments = data ?? [];
  }

  const enrichedPayments = payments.map((p) => ({
    ...p,
    invoice_display: invoiceMap.get(p.invoice_id)?.display_number ?? null,
  }));

  // Deposits
  let deposits: any[] = [];
  if (leaseIds.length > 0) {
    const { data } = await supabase
      .from("deposit")
      .select("id, lease_id, amount, status, refunded_amount")
      .in("lease_id", leaseIds);
    deposits = data ?? [];
  }

  const enrichedDeposits = deposits.map((d) => ({
    ...d,
    unit_number: unitMap.get(leaseToUnit.get(d.lease_id) ?? "")?.unit_number ?? null,
  }));

  // Ledger
  const { data: ledger } = await supabase
    .from("ledger_entry")
    .select("id, type, amount, balance_after, ref_invoice_id, created_at")
    .eq("tenant_id", tenant_id)
    .order("created_at", { ascending: false });

  // Activity (filtered by entity ids related to this tenant)
  const entityIds = [
    tenant_id,
    ...leaseIds,
    ...invoiceIds,
    ...payments.map((p: any) => p.id),
  ];

  const { data: activity } = entityIds.length > 0
    ? await supabase
        .from("audit_log")
        .select("id, action, entity_type, entity_id, created_at, reason")
        .in("entity_id", entityIds)
        .order("created_at", { ascending: false })
        .limit(50)
    : { data: [] as any[] };

  // ---- Stats ----
  const total_invoiced = invoices.reduce((s, i) => s + Number(i.amount ?? 0), 0);
  const total_paid = payments.reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const outstanding = invoices
    .filter((i) => i.status === "unpaid" || i.status === "overdue")
    .reduce((s, i) => s + Number(i.amount ?? 0), 0);
  const overdue_count = invoices.filter((i) => i.status === "overdue").length;
  const deposit_held = deposits
    .filter((d) => d.status === "held" || d.status === "partial")
    .reduce((s, d) => s + Number(d.amount ?? 0), 0);
  const active_leases = leaseRows.filter((l) => l.status === "active" || l.status === "expiring").length;
  const current_balance = total_invoiced - total_paid;

  return {
    tenant,
    leases: enrichedLeases,
    invoices: enrichedInvoices,
    payments: enrichedPayments,
    deposits: enrichedDeposits,
    ledger: (ledger ?? []) as any[],
    activity: (activity ?? []) as any[],
    stats: {
      total_invoiced,
      total_paid,
      outstanding,
      overdue_count,
      current_balance,
      active_leases,
      deposit_held,
    },
  };
}
`;

// =============================================================================
// 2. Profile header (avatar + name + status + key stats)
// =============================================================================
FILES["src/components/tenant/profile-header.tsx"] =
`import Link from "next/link";
import { Mail, Phone, MessageCircle, ArrowLeft, Pencil } from "lucide-react";
import { StatusPill } from "@/components/dashboard/status-pill";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { formatPHP } from "@/lib/utils/format-php";
import type { TenantProfile } from "@/lib/db/tenant-profile";

const STATUS_TONE: Record<string, "yellow" | "green" | "gray" | "red"> = {
  prospect: "yellow",
  active: "green",
  former: "gray",
  blacklisted: "red",
};

function initials(name: string) {
  return name
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function ProfileHeader({ profile }: { profile: TenantProfile }) {
  const { tenant, stats } = profile;

  return (
    <div className="space-y-6">
      <Link
        href="/property/tenants"
        className="inline-flex items-center gap-1.5 text-sm text-ink-500 transition-colors hover:text-ink-800"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All tenants
      </Link>

      {/* Header card */}
      <div className="flex flex-wrap items-start gap-5 rounded-xl border border-ink-200 bg-surface p-6 dark:border-white/[0.06]">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 text-lg font-semibold text-white shadow-sm">
          {initials(tenant.full_name)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-ink-900">
              {tenant.full_name}
            </h1>
            <StatusPill tone={STATUS_TONE[tenant.status] ?? "gray"} dot>
              {tenant.status}
            </StatusPill>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-600">
            {tenant.email && (
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-ink-400" />
                {tenant.email}
              </span>
            )}
            {tenant.phone && (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-ink-400" />
                {tenant.phone}
              </span>
            )}
            {tenant.messenger_name && (
              <span className="inline-flex items-center gap-1.5">
                <MessageCircle className="h-3.5 w-3.5 text-ink-400" />
                {tenant.messenger_name}
              </span>
            )}
          </div>
        </div>

        <Link href={"/property/tenants/" + tenant.id + "/edit"}>
          <Button variant="secondary">
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Edit
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total invoiced"
          value={formatPHP(stats.total_invoiced)}
          accent="brand"
        />
        <StatCard
          label="Total paid"
          value={formatPHP(stats.total_paid)}
          accent="green"
        />
        <StatCard
          label="Outstanding"
          value={formatPHP(stats.outstanding)}
          accent={stats.overdue_count > 0 ? "red" : "yellow"}
          deltaLabel={stats.overdue_count > 0 ? stats.overdue_count + " overdue" : "on track"}
        />
        <StatCard
          label="Deposit held"
          value={formatPHP(stats.deposit_held)}
          accent="purple"
        />
      </div>
    </div>
  );
}
`;

// =============================================================================
// 3. Overview tab
// =============================================================================
FILES["src/components/tenant/tabs/overview-tab.tsx"] =
`import Link from "next/link";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusPill } from "@/components/dashboard/status-pill";
import { formatPHP } from "@/lib/utils/format-php";
import type { TenantProfile } from "@/lib/db/tenant-profile";

const TERM_LABEL: Record<string, string> = {
  "1_month": "1 month",
  "3_months": "3 months",
  "6_months": "6 months",
  "1_year": "1 year",
  "2_years": "2 years",
  "3_years": "3 years",
  other: "Other",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function OverviewTab({ profile }: { profile: TenantProfile }) {
  const { tenant, leases } = profile;

  const activeLease = leases.find(
    (l) => l.status === "active" || l.status === "expiring"
  );

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Personal details */}
      <Card>
        <CardHeader title="Personal details" />
        <CardBody className="space-y-3 text-sm">
          <Row label="Full name" value={tenant.full_name} />
          <Row label="Email" value={tenant.email ?? "—"} />
          <Row label="Phone" value={tenant.phone ?? "—"} />
          <Row label="Messenger" value={tenant.messenger_name ?? "—"} />
          <Row label="Government ID" value={tenant.government_id ?? "—"} />
          <Row
            label="Status"
            value={
              <StatusPill tone={
                tenant.status === "active" ? "green"
                : tenant.status === "prospect" ? "yellow"
                : tenant.status === "blacklisted" ? "red"
                : "gray"
              } dot>
                {tenant.status}
              </StatusPill>
            }
          />
          <Row label="Tenant since" value={formatDate(tenant.created_at)} />
        </CardBody>
      </Card>

      {/* Current lease */}
      <Card>
        <CardHeader title="Current lease" />
        <CardBody className="text-sm">
          {activeLease ? (
            <div className="space-y-3">
              <Row label="Property" value={activeLease.property_name ?? "—"} />
              <Row label="Unit" value={activeLease.unit_number ?? "—"} />
              <Row label="Term" value={activeLease.term ? (TERM_LABEL[activeLease.term] ?? activeLease.term) : "—"} />
              <Row label="Intent" value={activeLease.intent ?? "—"} />
              <Row label="Start date" value={formatDate(activeLease.start_date)} />
              <Row label="End of contract" value={formatDate(activeLease.end_date)} />
              {activeLease.move_in_date && (
                <Row label="Move-in date" value={formatDate(activeLease.move_in_date)} />
              )}
              <Row label="Monthly rent" value={formatPHP(activeLease.monthly_rent)} />
              <Row
                label="Status"
                value={
                  <StatusPill tone={activeLease.status === "active" ? "green" : "yellow"} dot>
                    {activeLease.status}
                  </StatusPill>
                }
              />
              <Link
                href={"/property/leases/" + activeLease.id}
                className="mt-3 inline-block text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
              >
                View full lease →
              </Link>
            </div>
          ) : (
            <p className="py-6 text-center text-ink-500">
              No active lease on file.
            </p>
          )}
        </CardBody>
      </Card>

      {/* Summary row */}
      <Card className="lg:col-span-2">
        <CardHeader title="Summary" description="All-time figures" />
        <CardBody>
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            <Summary label="Total leases" value={String(leases.length)} />
            <Summary label="Active leases" value={String(profile.stats.active_leases)} />
            <Summary label="Total invoices" value={String(profile.invoices.length)} />
            <Summary label="Total payments" value={String(profile.payments.length)} />
            <Summary label="Total invoiced" value={formatPHP(profile.stats.total_invoiced)} />
            <Summary label="Total paid" value={formatPHP(profile.stats.total_paid)} />
            <Summary label="Outstanding" value={formatPHP(profile.stats.outstanding)} />
            <Summary label="Current balance" value={formatPHP(profile.stats.current_balance)} />
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

// =============================================================================
// 4. Leases tab
// =============================================================================
FILES["src/components/tenant/tabs/leases-tab.tsx"] =
`import Link from "next/link";
import { Card, CardBody } from "@/components/ui/card";
import { StatusPill } from "@/components/dashboard/status-pill";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { formatPHP } from "@/lib/utils/format-php";
import type { TenantProfile } from "@/lib/db/tenant-profile";

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

export function LeasesTab({ profile }: { profile: TenantProfile }) {
  if (profile.leases.length === 0) {
    return (
      <Card>
        <CardBody className="py-16 text-center text-sm text-ink-500">
          No leases on file.
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
              <TH>Term</TH>
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
                  <Link
                    href={"/property/leases/" + l.id}
                    className="text-brand-600 hover:underline dark:text-brand-400"
                  >
                    Unit {l.unit_number ?? "—"}
                  </Link>
                  <p className="text-xs text-ink-500">{l.property_name ?? ""}</p>
                </TD>
                <TD className="text-sm text-ink-600">
                  {l.term ? (TERM_LABEL[l.term] ?? l.term) : "—"}
                </TD>
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

// =============================================================================
// 5. Invoices tab
// =============================================================================
FILES["src/components/tenant/tabs/invoices-tab.tsx"] =
`import Link from "next/link";
import { Card, CardBody } from "@/components/ui/card";
import { StatusPill } from "@/components/dashboard/status-pill";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { formatPHP } from "@/lib/utils/format-php";
import type { TenantProfile } from "@/lib/db/tenant-profile";

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

export function InvoicesTab({ profile }: { profile: TenantProfile }) {
  if (profile.invoices.length === 0) {
    return (
      <Card>
        <CardBody className="py-16 text-center text-sm text-ink-500">
          No invoices on file.
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
              <TH>Unit</TH>
              <TH>Due</TH>
              <TH className="text-right">Amount</TH>
              <TH>Status</TH>
              <TH className="text-right"></TH>
            </TR>
          </THead>
          <TBody>
            {profile.invoices.map((inv) => (
              <TR key={inv.id}>
                <TD className="font-medium text-ink-900">
                  {inv.display_number ?? inv.id.slice(0, 8)}
                </TD>
                <TD className="text-sm text-ink-600">
                  {TYPE_LABEL[inv.type] ?? inv.type}
                </TD>
                <TD className="text-sm text-ink-600">{inv.unit_number ?? "—"}</TD>
                <TD className="text-sm text-ink-600">
                  {new Date(inv.due_date).toLocaleDateString("en-PH", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </TD>
                <TD className="text-right font-medium text-ink-900">
                  {formatPHP(inv.amount)}
                </TD>
                <TD>
                  <StatusPill tone={STATUS_TONE[inv.status] ?? "gray"} dot>
                    {inv.status}
                  </StatusPill>
                </TD>
                <TD className="text-right">
                  <Link
                    href={"/accounting/invoices/" + inv.id}
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

// =============================================================================
// 6. Payments tab
// =============================================================================
FILES["src/components/tenant/tabs/payments-tab.tsx"] =
`import Link from "next/link";
import { Receipt } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { formatPHP } from "@/lib/utils/format-php";
import type { TenantProfile } from "@/lib/db/tenant-profile";

export function PaymentsTab({ profile }: { profile: TenantProfile }) {
  if (profile.payments.length === 0) {
    return (
      <Card>
        <CardBody className="py-16 text-center text-sm text-ink-500">
          No payments on file.
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
                    <span className="font-medium text-ink-900">
                      {p.receipt_number ?? "—"}
                    </span>
                  </div>
                </TD>
                <TD className="text-sm text-ink-600">{p.invoice_display ?? "—"}</TD>
                <TD className="text-sm text-ink-600 capitalize">
                  {p.method.replace("_", " ")}
                </TD>
                <TD className="text-sm text-ink-600">
                  {new Date(p.paid_at).toLocaleDateString("en-PH", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </TD>
                <TD className="text-right font-medium text-success-700 dark:text-success-500">
                  {formatPHP(p.amount)}
                </TD>
                <TD className="text-right">
                  <Link
                    href={"/accounting/payments/" + p.id + "/receipt"}
                    className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
                  >
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

// =============================================================================
// 7. Deposits tab
// =============================================================================
FILES["src/components/tenant/tabs/deposits-tab.tsx"] =
`import Link from "next/link";
import { Wallet } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { StatusPill } from "@/components/dashboard/status-pill";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { formatPHP } from "@/lib/utils/format-php";
import type { TenantProfile } from "@/lib/db/tenant-profile";

const STATUS_TONE: Record<string, "yellow" | "brand" | "green" | "red"> = {
  held: "yellow",
  partial: "brand",
  returned: "green",
  forfeited: "red",
};

export function DepositsTab({ profile }: { profile: TenantProfile }) {
  if (profile.deposits.length === 0) {
    return (
      <Card>
        <CardBody className="py-16 text-center text-sm text-ink-500">
          No deposits on file.
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
                    <span className="font-medium text-ink-900">
                      Unit {d.unit_number ?? "—"}
                    </span>
                  </div>
                </TD>
                <TD className="text-sm text-ink-900">{formatPHP(d.amount)}</TD>
                <TD className="text-sm text-ink-600">{formatPHP(d.refunded_amount)}</TD>
                <TD>
                  <StatusPill tone={STATUS_TONE[d.status] ?? "gray"} dot>
                    {d.status}
                  </StatusPill>
                </TD>
                <TD className="text-right">
                  <Link
                    href="/accounting/deposits"
                    className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
                  >
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

// =============================================================================
// 8. Ledger tab
// =============================================================================
FILES["src/components/tenant/tabs/ledger-tab.tsx"] =
`import { Card, CardBody } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { StatusPill } from "@/components/dashboard/status-pill";
import { formatPHP } from "@/lib/utils/format-php";
import type { TenantProfile } from "@/lib/db/tenant-profile";

export function LedgerTab({ profile }: { profile: TenantProfile }) {
  if (profile.ledger.length === 0) {
    return (
      <Card>
        <CardBody className="py-16 text-center text-sm text-ink-500">
          No ledger entries yet. Ledger entries are created automatically when invoices and payments are recorded.
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
              <TH>Date</TH>
              <TH>Type</TH>
              <TH>Reference</TH>
              <TH className="text-right">Amount</TH>
              <TH className="text-right">Balance after</TH>
            </TR>
          </THead>
          <TBody>
            {profile.ledger.map((entry) => (
              <TR key={entry.id}>
                <TD className="text-sm text-ink-600">
                  {new Date(entry.created_at).toLocaleDateString("en-PH", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </TD>
                <TD>
                  <StatusPill tone={entry.type === "debit" ? "red" : "green"}>
                    {entry.type}
                  </StatusPill>
                </TD>
                <TD className="text-sm text-ink-600">
                  {entry.ref_invoice_id ? entry.ref_invoice_id.slice(0, 8) : "—"}
                </TD>
                <TD className={"text-right font-medium " + (entry.type === "debit" ? "text-danger-700 dark:text-danger-500" : "text-success-700 dark:text-success-500")}>
                  {entry.type === "debit" ? "+" : "-"}
                  {formatPHP(entry.amount)}
                </TD>
                <TD className="text-right font-semibold text-ink-900">
                  {formatPHP(entry.balance_after)}
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

// =============================================================================
// 9. Activity tab
// =============================================================================
FILES["src/components/tenant/tabs/activity-tab.tsx"] =
`import { Card, CardBody } from "@/components/ui/card";
import { StatusPill } from "@/components/dashboard/status-pill";
import type { TenantProfile } from "@/lib/db/tenant-profile";

const ACTION_TONE: Record<string, "green" | "brand" | "red" | "gray"> = {
  create: "green",
  update: "brand",
  delete: "red",
  archive: "gray",
};

export function ActivityTab({ profile }: { profile: TenantProfile }) {
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
              <StatusPill tone={ACTION_TONE[a.action] ?? "gray"}>
                {a.action}
              </StatusPill>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-ink-800">
                  <span className="capitalize">{a.action}</span>{" "}
                  <span className="text-ink-500">{a.entity_type.replace("_", " ")}</span>
                </p>
                {a.reason && (
                  <p className="mt-0.5 text-xs text-ink-500">{a.reason}</p>
                )}
              </div>
              <span className="shrink-0 text-xs text-ink-400">
                {new Date(a.created_at).toLocaleString("en-PH", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
`;

// =============================================================================
// 10. Tabs wrapper (client) — combines profile header + tab state
// =============================================================================
FILES["src/components/tenant/tenant-profile.tsx"] =
`"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { ProfileHeader } from "./profile-header";
import { OverviewTab } from "./tabs/overview-tab";
import { LeasesTab } from "./tabs/leases-tab";
import { InvoicesTab } from "./tabs/invoices-tab";
import { PaymentsTab } from "./tabs/payments-tab";
import { DepositsTab } from "./tabs/deposits-tab";
import { LedgerTab } from "./tabs/ledger-tab";
import { ActivityTab } from "./tabs/activity-tab";
import type { TenantProfile as Profile } from "@/lib/db/tenant-profile";

type TabKey = "overview" | "leases" | "invoices" | "payments" | "deposits" | "ledger" | "activity";

export function TenantProfileView({ profile }: { profile: Profile }) {
  const [tab, setTab] = useState<TabKey>("overview");

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: "overview", label: "Overview" },
    { key: "leases", label: "Leases", count: profile.leases.length },
    { key: "invoices", label: "Invoices", count: profile.invoices.length },
    { key: "payments", label: "Payments", count: profile.payments.length },
    { key: "deposits", label: "Deposits", count: profile.deposits.length },
    { key: "ledger", label: "Ledger", count: profile.ledger.length },
    { key: "activity", label: "Activity" },
  ];

  return (
    <div className="space-y-6">
      <ProfileHeader profile={profile} />

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
          {tab === "overview" && <OverviewTab profile={profile} />}
          {tab === "leases" && <LeasesTab profile={profile} />}
          {tab === "invoices" && <InvoicesTab profile={profile} />}
          {tab === "payments" && <PaymentsTab profile={profile} />}
          {tab === "deposits" && <DepositsTab profile={profile} />}
          {tab === "ledger" && <LedgerTab profile={profile} />}
          {tab === "activity" && <ActivityTab profile={profile} />}
        </div>
      </div>
    </div>
  );
}
`;

// =============================================================================
// 11. Rewrite the tenant detail page
// =============================================================================
FILES["src/app/(dashboard)/property/tenants/[id]/page.tsx"] =
`import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/guard";
import { getTenantProfile } from "@/lib/db/tenant-profile";
import { TenantProfileView } from "@/components/tenant/tenant-profile";

export default async function TenantProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("tenant:read");
  const { id } = await params;

  const profile = await getTenantProfile(id);
  if (!profile) notFound();

  return <TenantProfileView profile={profile} />;
}
`;

// =============================================================================
// 12. Edit page (moved from [id] to [id]/edit)
// =============================================================================
FILES["src/app/(dashboard)/property/tenants/[id]/edit/page.tsx"] =
`import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/guard";
import { getTenant } from "@/lib/db/tenants";
import { PageHeader } from "@/components/layout/page-header";
import { TenantForm } from "@/components/tenant/tenant-form";

export default async function EditTenantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("tenant:read");
  const { id } = await params;
  const tenant = await getTenant(id);
  if (!tenant) notFound();

  return (
    <div>
      <Link
        href={"/property/tenants/" + id}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-ink-500 transition-colors hover:text-ink-800"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to profile
      </Link>
      <PageHeader title={"Edit " + tenant.full_name} />
      <TenantForm mode="edit" tenant={tenant} />
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

  console.log("Tenant profile page\\n");

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
  console.log("  Visit /property/tenants → click a tenant");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});