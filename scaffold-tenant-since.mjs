#!/usr/bin/env node
/**
 * Tenant profile — "Tenant since" uses first move-in date
 * Usage: node scaffold-tenant-since.mjs
 *
 * Updates:
 *   src/lib/db/tenant-profile.ts
 *   src/components/tenant/tabs/overview-tab.tsx
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
// Updated tenant-profile.ts — expose first_move_in_date in stats
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
    /** Earliest move-in date across all leases. Null if no leases have move-in dates. */
    first_move_in_date: string | null;
  };
};

export async function getTenantProfile(tenant_id: string): Promise<TenantProfile | null> {
  const supabase = await createClient();

  const { data: tenant } = await supabase
    .from("tenant")
    .select("id, full_name, email, phone, messenger_name, government_id, status, created_at")
    .eq("id", tenant_id)
    .maybeSingle();

  if (!tenant) return null;

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

  const { data: ledger } = await supabase
    .from("ledger_entry")
    .select("id, type, amount, balance_after, ref_invoice_id, created_at")
    .eq("tenant_id", tenant_id)
    .order("created_at", { ascending: false });

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

  // ---- Compute the tenant's first move-in date ----
  // Priority:
  //   1. Earliest lease.move_in_date (most accurate for "actually moved in")
  //   2. Earliest lease.start_date (fallback if move_in_date is missing)
  //   3. Tenant's created_at (fallback if no leases at all)
  const moveInDates = leaseRows
    .map((l) => l.move_in_date)
    .filter((d): d is string => !!d);

  let first_move_in_date: string | null = null;
  if (moveInDates.length > 0) {
    first_move_in_date = moveInDates.sort()[0];
  } else {
    const startDates = leaseRows
      .map((l) => l.start_date)
      .filter((d): d is string => !!d);
    if (startDates.length > 0) {
      first_move_in_date = startDates.sort()[0];
    } else {
      first_move_in_date = tenant.created_at.slice(0, 10);
    }
  }

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
      first_move_in_date,
    },
  };
}
`;

// =============================================================================
// Updated overview-tab — "Tenant since" uses first_move_in_date
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
  const { tenant, leases, stats } = profile;

  const activeLease = leases.find(
    (l) => l.status === "active" || l.status === "expiring"
  );

  // Label adjusts based on whether we have any lease history
  const sinceLabel = leases.length > 0 ? "Tenant since" : "Record created";

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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
          {stats.first_move_in_date && (
            <Row label={sinceLabel} value={formatDate(stats.first_move_in_date)} />
          )}
        </CardBody>
      </Card>

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

      <Card className="lg:col-span-2">
        <CardHeader title="Summary" description="All-time figures" />
        <CardBody>
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            <Summary label="Total leases" value={String(leases.length)} />
            <Summary label="Active leases" value={String(stats.active_leases)} />
            <Summary label="Total invoices" value={String(profile.invoices.length)} />
            <Summary label="Total payments" value={String(profile.payments.length)} />
            <Summary label="Total invoiced" value={formatPHP(stats.total_invoiced)} />
            <Summary label="Total paid" value={formatPHP(stats.total_paid)} />
            <Summary label="Outstanding" value={formatPHP(stats.outstanding)} />
            <Summary label="Current balance" value={formatPHP(stats.current_balance)} />
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

// -----------------------------------------------------------------------------
// Runner
// -----------------------------------------------------------------------------
async function main() {
  const pkg = join(ROOT, "package.json");
  if (!(await exists(pkg))) {
    console.error("package.json not found. Run from project root.");
    process.exit(1);
  }

  console.log("Tenant profile — use move-in date for \\``Tenant since\\``\\n");

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
  console.log("  Visit any tenant profile → Overview tab");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});