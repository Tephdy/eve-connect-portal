#!/usr/bin/env node
/**
 * Unit profile — rental archive with tenant details per lease
 * Usage: node scaffold-unit-archive.mjs
 *
 * Updates:
 *   src/lib/db/unit-profile.ts                      (expand lease rows + payment summary)
 *   src/components/unit/tabs/lease-history-tab.tsx  (rename label → Rental archive, expanded view)
 *   src/components/unit/unit-profile.tsx            (rename tab label)
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
// 1. Updated unit-profile.ts — richer lease rows with tenant + payment data
// =============================================================================
FILES["src/lib/db/unit-profile.ts"] =
`import "server-only";
import { createClient } from "@/lib/supabase/server";

export type UnitLeaseRow = {
  id: string;
  tenant_id: string;
  tenant_name: string | null;
  tenant_email: string | null;
  tenant_phone: string | null;
  tenant_messenger_name: string | null;
  tenant_government_id: string | null;
  tenant_status: string | null;
  start_date: string;
  end_date: string;
  move_in_date: string | null;
  due_date: string | null;
  monthly_rent: number;
  deposit_1: number | null;
  deposit_2: number | null;
  deposit_amount: number | null;
  ad_ons: unknown;
  ad_ons_amount: number | null;
  notice_period_days: number | null;
  term: string | null;
  intent: string | null;
  status: string;
  created_at: string;
  // Aggregated per lease
  total_invoiced: number;
  total_paid: number;
  outstanding: number;
  invoice_count: number;
  payment_count: number;
};

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
  leases: UnitLeaseRow[];
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
    total_tenants_served: number;
    lifetime_revenue: number;
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

  // ---- Leases (all history) ----
  const { data: leases } = await supabase
    .from("lease")
    .select(
      "id, tenant_id, tenant_name, start_date, end_date, move_in_date, due_date, monthly_rent, deposit_1, deposit_2, deposit_amount, ad_ons, ad_ons_amount, notice_period_days, term, intent, status, created_at"
    )
    .eq("unit_id", id)
    .order("start_date", { ascending: false });

  const leaseRows = (leases ?? []) as any[];
  const tenantIds = Array.from(new Set(leaseRows.map((l) => l.tenant_id))).filter(Boolean);

  // ---- Tenants ----
  let tenantMap = new Map<string, any>();
  if (tenantIds.length > 0) {
    const { data: tenants } = await supabase
      .from("tenant")
      .select("id, full_name, email, phone, messenger_name, government_id, status")
      .in("id", tenantIds);
    for (const t of tenants ?? []) tenantMap.set(t.id, t);
  }

  // ---- Invoice + payment totals per lease ----
  const leaseIds = leaseRows.map((l) => l.id);

  let invoiceTotals = new Map<string, { invoiced: number; outstanding: number; count: number }>();
  let paymentTotals = new Map<string, { paid: number; count: number }>();

  if (leaseIds.length > 0) {
    const { data: invoices } = await supabase
      .from("invoice")
      .select("id, lease_id, amount, status")
      .in("lease_id", leaseIds);

    const invoiceRows = (invoices ?? []) as any[];
    const invoiceIds = invoiceRows.map((i) => i.id);

    for (const inv of invoiceRows) {
      const cur = invoiceTotals.get(inv.lease_id) ?? { invoiced: 0, outstanding: 0, count: 0 };
      const amt = Number(inv.amount ?? 0);
      cur.invoiced += amt;
      if (inv.status === "unpaid" || inv.status === "overdue") cur.outstanding += amt;
      cur.count += 1;
      invoiceTotals.set(inv.lease_id, cur);
    }

    if (invoiceIds.length > 0) {
      const { data: payments } = await supabase
        .from("payment")
        .select("invoice_id, amount")
        .in("invoice_id", invoiceIds);

      // Map invoice → lease for payment aggregation
      const invToLease = new Map(invoiceRows.map((i: any) => [i.id, i.lease_id]));

      for (const p of payments ?? []) {
        const leaseId = invToLease.get(p.invoice_id);
        if (!leaseId) continue;
        const cur = paymentTotals.get(leaseId) ?? { paid: 0, count: 0 };
        cur.paid += Number(p.amount ?? 0);
        cur.count += 1;
        paymentTotals.set(leaseId, cur);
      }
    }
  }

  const enrichedLeases: UnitLeaseRow[] = leaseRows.map((l) => {
    const tenant = tenantMap.get(l.tenant_id);
    const inv = invoiceTotals.get(l.id) ?? { invoiced: 0, outstanding: 0, count: 0 };
    const pay = paymentTotals.get(l.id) ?? { paid: 0, count: 0 };
    return {
      id: l.id,
      tenant_id: l.tenant_id,
      tenant_name: l.tenant_name ?? tenant?.full_name ?? null,
      tenant_email: tenant?.email ?? null,
      tenant_phone: tenant?.phone ?? null,
      tenant_messenger_name: tenant?.messenger_name ?? null,
      tenant_government_id: tenant?.government_id ?? null,
      tenant_status: tenant?.status ?? null,
      start_date: l.start_date,
      end_date: l.end_date,
      move_in_date: l.move_in_date,
      due_date: l.due_date,
      monthly_rent: Number(l.monthly_rent ?? 0),
      deposit_1: l.deposit_1,
      deposit_2: l.deposit_2,
      deposit_amount: l.deposit_amount,
      ad_ons: l.ad_ons,
      ad_ons_amount: l.ad_ons_amount,
      notice_period_days: l.notice_period_days,
      term: l.term,
      intent: l.intent,
      status: l.status,
      created_at: l.created_at,
      total_invoiced: inv.invoiced,
      total_paid: pay.paid,
      outstanding: inv.outstanding,
      invoice_count: inv.count,
      payment_count: pay.count,
    };
  });

  // ---- Job orders ----
  const { data: jobOrders } = await supabase
    .from("job_order")
    .select("id, task_type_id, priority, status, description, cost_estimate, created_at")
    .eq("unit_id", id)
    .order("created_at", { ascending: false });

  const taskTypeIds = Array.from(new Set((jobOrders ?? []).map((j: any) => j.task_type_id))).filter(Boolean);
  const { data: taskTypes } = taskTypeIds.length > 0
    ? await supabase.from("job_task_type").select("id, name").in("id", taskTypeIds)
    : { data: [] as { id: string; name: string }[] };
  const taskMap = new Map((taskTypes ?? []).map((t: any) => [t.id, t.name]));

  // ---- Assets ----
  const { data: assets } = await supabase
    .from("asset")
    .select("id, name, type, install_date, warranty_until")
    .eq("unit_id", id)
    .order("name");

  const activeLease = enrichedLeases.find((l) => l.status === "active" || l.status === "expiring");
  const openJobs = (jobOrders ?? []).filter((j: any) => j.status !== "done" && j.status !== "cancelled").length;

  // Lifetime revenue: sum of all payments across all leases for this unit
  const lifetime_revenue = Array.from(paymentTotals.values()).reduce((s, v) => s + v.paid, 0);

  return {
    unit: {
      ...unit,
      property_name: property?.name ?? null,
      property_address: property?.address ?? null,
    },
    leases: enrichedLeases,
    jobOrders: (jobOrders ?? []).map((j: any) => ({
      ...j,
      task_type_name: taskMap.get(j.task_type_id) ?? null,
    })),
    assets: (assets ?? []) as any[],
    stats: {
      current_tenant: activeLease?.tenant_name ?? null,
      lease_status: activeLease?.status ?? null,
      monthly_rent: Number(activeLease?.monthly_rent ?? unit.base_rent ?? 0),
      lease_end: activeLease?.end_date ?? null,
      open_jobs: openJobs,
      total_assets: (assets ?? []).length,
      total_tenants_served: new Set(enrichedLeases.map((l) => l.tenant_id)).size,
      lifetime_revenue,
    },
  };
}
`;

// =============================================================================
// 2. Updated lease-history-tab — expandable archive with tenant details
// =============================================================================
FILES["src/components/unit/tabs/lease-history-tab.tsx"] =
`"use client";

import { useState } from "react";
import Link from "next/link";
import {
  FileText,
  ChevronDown,
  Mail,
  Phone,
  MessageCircle,
  IdCard,
  Calendar,
  Banknote,
  Tag,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Card, CardBody } from "@/components/ui/card";
import { StatusPill } from "@/components/dashboard/status-pill";
import { Button } from "@/components/ui/button";
import { formatPHP } from "@/lib/utils/format-php";
import type { UnitProfile, UnitLeaseRow } from "@/lib/db/unit-profile";

const STATUS_TONE: Record<string, "gray" | "green" | "yellow" | "red" | "brand"> = {
  draft: "gray",
  active: "green",
  expiring: "yellow",
  ended: "brand",
  terminated: "red",
};

const TENANT_STATUS_TONE: Record<string, "green" | "yellow" | "gray" | "red"> = {
  active: "green",
  prospect: "yellow",
  former: "gray",
  blacklisted: "red",
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

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function adOnsList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x: any) => (typeof x === "string" ? x : x.text ?? "")).filter(Boolean);
}

export function UnitLeaseHistoryTab({ profile }: { profile: UnitProfile }) {
  if (profile.leases.length === 0) {
    return (
      <Card>
        <CardBody className="py-16 text-center text-sm text-ink-500">
          No rental history for this unit yet.
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {profile.leases.map((lease) => (
        <LeaseArchiveCard key={lease.id} lease={lease} />
      ))}
    </div>
  );
}

function LeaseArchiveCard({ lease }: { lease: UnitLeaseRow }) {
  const [open, setOpen] = useState(false);
  const adOns = adOnsList(lease.ad_ons);

  const isCurrent = lease.status === "active" || lease.status === "expiring";
  const duration = Math.max(
    0,
    Math.ceil((new Date(lease.end_date).getTime() - new Date(lease.start_date).getTime()) / 86400000)
  );

  return (
    <Card className="overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-ink-50 dark:hover:bg-white/[0.02]",
          open && "border-b border-ink-200 dark:border-white/[0.06]"
        )}
      >
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg",
            isCurrent
              ? "bg-brand-500/10 text-brand-600 dark:text-brand-400"
              : "bg-ink-100 text-ink-500 dark:bg-white/[0.06]"
          )}
        >
          <FileText className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold text-ink-900">
              {lease.tenant_name ?? "Unknown tenant"}
            </span>
            <StatusPill tone={STATUS_TONE[lease.status] ?? "gray"} dot>
              {lease.status}
            </StatusPill>
            {isCurrent && (
              <span className="text-xs font-medium text-brand-600 dark:text-brand-400">
                Currently residing
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-500">
            <span>{formatDate(lease.start_date)} → {formatDate(lease.end_date)}</span>
            <span>·</span>
            <span>{Math.round(duration / 30)} months</span>
            {lease.term && (
              <>
                <span>·</span>
                <span>{TERM_LABEL[lease.term] ?? lease.term}</span>
              </>
            )}
          </div>
        </div>

        <div className="hidden shrink-0 text-right md:block">
          <p className="text-sm font-semibold text-ink-900">
            {formatPHP(lease.monthly_rent)}
          </p>
          <p className="text-xs text-ink-500">monthly rent</p>
        </div>

        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-ink-400 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {/* Details — expandable */}
      {open && (
        <CardBody className="space-y-6">
          {/* Row 1: Tenant details + Link */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-500">
                Tenant details
              </h4>
              <div className="space-y-2.5 text-sm">
                <InfoRow
                  icon={<Mail className="h-3.5 w-3.5" />}
                  label="Email"
                  value={lease.tenant_email ?? "—"}
                />
                <InfoRow
                  icon={<Phone className="h-3.5 w-3.5" />}
                  label="Phone"
                  value={lease.tenant_phone ?? "—"}
                />
                <InfoRow
                  icon={<MessageCircle className="h-3.5 w-3.5" />}
                  label="Messenger"
                  value={lease.tenant_messenger_name ?? "—"}
                />
                <InfoRow
                  icon={<IdCard className="h-3.5 w-3.5" />}
                  label="Government ID"
                  value={lease.tenant_government_id ?? "—"}
                />
                {lease.tenant_status && (
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-ink-500">Status</span>
                    <StatusPill tone={TENANT_STATUS_TONE[lease.tenant_status] ?? "gray"} dot>
                      {lease.tenant_status}
                    </StatusPill>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-500">
                Lease details
              </h4>
              <div className="space-y-2.5 text-sm">
                <InfoRow
                  icon={<Calendar className="h-3.5 w-3.5" />}
                  label="Start date"
                  value={formatDate(lease.start_date)}
                />
                <InfoRow
                  icon={<Calendar className="h-3.5 w-3.5" />}
                  label="End of contract"
                  value={formatDate(lease.end_date)}
                />
                {lease.move_in_date && (
                  <InfoRow
                    icon={<Calendar className="h-3.5 w-3.5" />}
                    label="Move-in date"
                    value={formatDate(lease.move_in_date)}
                  />
                )}
                {lease.due_date && (
                  <InfoRow
                    icon={<Calendar className="h-3.5 w-3.5" />}
                    label="Rent due date"
                    value={formatDate(lease.due_date)}
                  />
                )}
                <InfoRow
                  icon={<Tag className="h-3.5 w-3.5" />}
                  label="Intent"
                  value={lease.intent ?? "—"}
                />
                {lease.notice_period_days != null && (
                  <InfoRow
                    icon={<Tag className="h-3.5 w-3.5" />}
                    label="Notice period"
                    value={lease.notice_period_days + " days"}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Row 2: Financials */}
          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-500">
              Financials
            </h4>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Stat label="Monthly rent" value={formatPHP(lease.monthly_rent)} />
              <Stat label="1st deposit" value={formatPHP(lease.deposit_1 ?? 0)} />
              <Stat label="2nd deposit" value={formatPHP(lease.deposit_2 ?? 0)} />
              <Stat label="Add-ons amount" value={formatPHP(lease.ad_ons_amount ?? 0)} />
            </div>

            {adOns.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-ink-500">Add-ons:</span>
                {adOns.map((a, i) => (
                  <StatusPill key={i} tone="brand">{a}</StatusPill>
                ))}
              </div>
            )}
          </div>

          {/* Row 3: Payment summary for this lease */}
          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-500">
              Payment summary
            </h4>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Stat label="Total invoiced" value={formatPHP(lease.total_invoiced)} sub={lease.invoice_count + " invoices"} />
              <Stat label="Total paid" value={formatPHP(lease.total_paid)} sub={lease.payment_count + " payments"} accent="success" />
              <Stat
                label="Outstanding"
                value={formatPHP(lease.outstanding)}
                accent={lease.outstanding > 0 ? "danger" : "default"}
              />
              <Stat
                label="Lease duration"
                value={Math.round(duration / 30) + " mo"}
                sub={duration + " days"}
              />
            </div>
          </div>

          {/* Row 4: Actions */}
          <div className="flex flex-wrap gap-2 border-t border-ink-100 pt-4 dark:border-white/[0.04]">
            <Link href={"/property/leases/" + lease.id}>
              <Button variant="secondary" size="sm">
                <FileText className="mr-1.5 h-3.5 w-3.5" />
                Open lease
              </Button>
            </Link>
            <Link href={"/property/tenants/" + lease.tenant_id}>
              <Button variant="secondary" size="sm">
                <IdCard className="mr-1.5 h-3.5 w-3.5" />
                View tenant profile
              </Button>
            </Link>
            <Link href={"/accounting/invoices?q=" + (lease.tenant_name ?? "")}>
              <Button variant="ghost" size="sm">
                <Banknote className="mr-1.5 h-3.5 w-3.5" />
                View invoices
              </Button>
            </Link>
          </div>
        </CardBody>
      )}
    </Card>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="flex items-center gap-1.5 text-ink-500">
        <span className="text-ink-400">{icon}</span>
        {label}
      </span>
      <span className="text-right font-medium text-ink-900">{value}</span>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  accent = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "default" | "success" | "danger";
}) {
  const valueColor =
    accent === "success"
      ? "text-success-700 dark:text-success-500"
      : accent === "danger"
      ? "text-danger-700 dark:text-danger-500"
      : "text-ink-900";
  return (
    <div className="rounded-lg border border-ink-200 bg-surface-muted px-3 py-2.5 dark:border-white/[0.06] dark:bg-white/[0.02]">
      <p className="text-xs text-ink-500">{label}</p>
      <p className={cn("mt-0.5 text-sm font-semibold", valueColor)}>{value}</p>
      {sub && <p className="text-xs text-ink-400 mt-0.5">{sub}</p>}
    </div>
  );
}
`;

// =============================================================================
// 3. Unit profile — rename tab label + add archive stat
// =============================================================================
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

type TabKey = "overview" | "archive" | "jobs" | "assets";

export function UnitProfileView({ profile }: { profile: Profile }) {
  const [tab, setTab] = useState<TabKey>("overview");

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: "overview", label: "Overview" },
    { key: "archive", label: "Rental archive", count: profile.leases.length },
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
          {tab === "archive" && <UnitLeaseHistoryTab profile={profile} />}
          {tab === "jobs" && <UnitJobOrdersTab profile={profile} />}
          {tab === "assets" && <UnitAssetsTab profile={profile} />}
        </div>
      </div>
    </div>
  );
}
`;

// =============================================================================
// 4. Unit profile header — add "tenants served" + "lifetime revenue"
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
          label="Tenants served"
          value={stats.total_tenants_served}
          accent="purple"
          deltaLabel={stats.total_tenants_served + " all time"}
        />
        <StatCard
          label="Lifetime revenue"
          value={formatPHP(stats.lifetime_revenue)}
          accent="yellow"
        />
      </div>
    </div>
  );
}
`;

// =============================================================================
// 5. Unit overview — replace quick facts with archive stats
// =============================================================================
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
        <CardHeader title="Unit history" description="All-time figures" />
        <CardBody>
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            <Summary label="Total leases" value={String(profile.leases.length)} />
            <Summary label="Tenants served" value={String(stats.total_tenants_served)} />
            <Summary label="Lifetime revenue" value={formatPHP(stats.lifetime_revenue)} />
            <Summary label="Job orders" value={String(profile.jobOrders.length)} />
            <Summary label="Assets tracked" value={String(profile.assets.length)} />
            <Summary label="Open job orders" value={String(stats.open_jobs)} />
            <Summary
              label="First rented"
              value={
                profile.leases.length > 0
                  ? new Date(profile.leases[profile.leases.length - 1].start_date).toLocaleDateString("en-PH", { month: "short", year: "numeric" })
                  : "—"
              }
            />
            <Summary
              label="Last rented"
              value={
                profile.leases.length > 0
                  ? new Date(profile.leases[0].start_date).toLocaleDateString("en-PH", { month: "short", year: "numeric" })
                  : "—"
              }
            />
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

  console.log("Unit profile — rental archive\\n");

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
  console.log("  Visit /property/units → click any unit → Rental archive tab");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});