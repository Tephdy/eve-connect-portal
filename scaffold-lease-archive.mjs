#!/usr/bin/env node
/**
 * Lease profile archive + tenant lease archive
 * Usage: node scaffold-lease-archive.mjs
 *
 * Updates:
 *   src/lib/db/lease-profile.ts                       (richer data)
 *   src/lib/db/tenant-profile.ts                      (lease rows get payment summaries)
 *   src/components/tenant/tabs/leases-tab.tsx         (expandable archive cards)
 *   src/components/lease/tabs/overview-tab.tsx        (full details inline)
 *   src/components/lease/tabs/activity-tab.tsx        (chronological timeline)
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
// 1. Enhanced lease-profile.ts — add contract URL, deposit detail, richer data
// =============================================================================
FILES["src/lib/db/lease-profile.ts"] =
`import "server-only";
import { createClient } from "@/lib/supabase/server";

export type LeaseInvoiceRow = {
  id: string;
  display_number: string | null;
  type: string;
  amount: number;
  due_date: string;
  status: string;
  created_at: string;
};

export type LeasePaymentRow = {
  id: string;
  invoice_id: string;
  receipt_number: string | null;
  amount: number;
  method: string;
  reference_no: string | null;
  paid_at: string;
  invoice_display: string | null;
};

export type LeaseDepositRow = {
  id: string;
  amount: number;
  status: string;
  refunded_amount: number;
};

export type LeaseProfile = {
  lease: {
    id: string;
    unit_id: string;
    unit_number: string | null;
    property_id: string | null;
    property_name: string | null;
    property_address: string | null;
    tenant_id: string;
    tenant_name: string | null;
    tenant_email: string | null;
    tenant_phone: string | null;
    tenant_messenger_name: string | null;
    tenant_government_id: string | null;
    tenant_status: string | null;
    tenant_since: string | null;
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
  invoices: LeaseInvoiceRow[];
  payments: LeasePaymentRow[];
  deposits: LeaseDepositRow[];
  contract: {
    id: string;
    status: string;
    signed_at: string | null;
    signed_document_url: string | null;
    tenant_signature_url: string | null;
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
    overdue_count: number;
    paid_count: number;
    unpaid_count: number;
    days_remaining: number;
    days_elapsed: number;
    is_expiring_soon: boolean;
    duration_days: number;
    deposit_held: number;
    deposit_refunded: number;
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

  // Unit + property
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

  // Tenant
  const { data: tenant } = await supabase
    .from("tenant")
    .select("id, full_name, email, phone, messenger_name, government_id, status, created_at")
    .eq("id", lease.tenant_id)
    .maybeSingle();

  // Tenant's earliest move-in across all their leases (for "tenant since")
  let tenant_since: string | null = null;
  if (tenant) {
    const { data: tenantLeases } = await supabase
      .from("lease")
      .select("move_in_date, start_date")
      .eq("tenant_id", tenant.id);

    const dates: string[] = [];
    for (const l of tenantLeases ?? []) {
      const d = (l as any).move_in_date ?? (l as any).start_date;
      if (d) dates.push(d);
    }
    if (dates.length > 0) {
      tenant_since = dates.sort()[0];
    } else {
      tenant_since = tenant.created_at.slice(0, 10);
    }
  }

  // Invoices
  const { data: invoices } = await supabase
    .from("invoice")
    .select("id, display_number, type, amount, due_date, status, created_at")
    .eq("lease_id", id)
    .order("due_date", { ascending: false });

  const invoiceRows = (invoices ?? []) as any[];
  const invoiceIds = invoiceRows.map((i) => i.id);
  const invoiceMap = new Map(invoiceRows.map((i) => [i.id, i]));

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

  const enrichedPayments: LeasePaymentRow[] = payments.map((p) => ({
    ...p,
    invoice_display: invoiceMap.get(p.invoice_id)?.display_number ?? null,
  }));

  // Deposits
  const { data: deposits } = await supabase
    .from("deposit")
    .select("id, amount, status, refunded_amount")
    .eq("lease_id", id);

  // Contract
  const { data: contract } = await supabase
    .from("contract")
    .select("id, status, signed_at, signed_document_url, tenant_signature, template_id")
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

  // Activity
  const entityIds = [id, ...invoiceIds, ...payments.map((p: any) => p.id)];
  const { data: activity } = entityIds.length > 0
    ? await supabase
        .from("audit_log")
        .select("id, action, entity_type, entity_id, created_at, reason")
        .in("entity_id", entityIds)
        .order("created_at", { ascending: false })
        .limit(50)
    : { data: [] as any[] };

  // Stats
  const total_invoiced = invoiceRows.reduce((s, i) => s + Number(i.amount ?? 0), 0);
  const total_paid = payments.reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const outstanding = invoiceRows
    .filter((i) => i.status === "unpaid" || i.status === "overdue")
    .reduce((s, i) => s + Number(i.amount ?? 0), 0);
  const overdue_count = invoiceRows.filter((i) => i.status === "overdue").length;
  const paid_count = invoiceRows.filter((i) => i.status === "paid").length;
  const unpaid_count = invoiceRows.filter((i) => i.status === "unpaid").length;

  const days_remaining = Math.ceil(
    (new Date(lease.end_date).getTime() - Date.now()) / 86400000
  );
  const days_elapsed = Math.ceil(
    (Date.now() - new Date(lease.start_date).getTime()) / 86400000
  );
  const duration_days = Math.max(
    0,
    Math.ceil((new Date(lease.end_date).getTime() - new Date(lease.start_date).getTime()) / 86400000)
  );

  const deposit_held = (deposits ?? [])
    .filter((d: any) => d.status === "held" || d.status === "partial")
    .reduce((s: number, d: any) => s + Number(d.amount ?? 0), 0);
  const deposit_refunded = (deposits ?? []).reduce(
    (s: number, d: any) => s + Number(d.refunded_amount ?? 0),
    0
  );

  return {
    lease: {
      ...lease,
      property_id: unit?.property_id ?? null,
      property_name: property?.name ?? null,
      property_address: property?.address ?? null,
      tenant_email: tenant?.email ?? null,
      tenant_phone: tenant?.phone ?? null,
      tenant_messenger_name: tenant?.messenger_name ?? null,
      tenant_government_id: tenant?.government_id ?? null,
      tenant_status: tenant?.status ?? null,
      tenant_since,
    },
    invoices: invoiceRows as LeaseInvoiceRow[],
    payments: enrichedPayments,
    deposits: (deposits ?? []) as LeaseDepositRow[],
    contract: contract
      ? {
          id: contract.id,
          status: contract.status,
          signed_at: contract.signed_at,
          signed_document_url: contract.signed_document_url,
          tenant_signature_url: contract.tenant_signature,
          template_name,
        }
      : null,
    activity: (activity ?? []) as any[],
    stats: {
      total_invoiced,
      total_paid,
      outstanding,
      overdue_count,
      paid_count,
      unpaid_count,
      days_remaining,
      days_elapsed,
      is_expiring_soon: days_remaining <= 30 && days_remaining >= 0,
      duration_days,
      deposit_held,
      deposit_refunded,
    },
  };
}
`;

// =============================================================================
// 2. Enhanced lease Overview tab — full tenant + property + terms + financials
// =============================================================================
FILES["src/components/lease/tabs/overview-tab.tsx"] =
`import Link from "next/link";
import {
  Mail,
  Phone,
  MessageCircle,
  IdCard,
  Calendar,
  Banknote,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusPill } from "@/components/dashboard/status-pill";
import { Button } from "@/components/ui/button";
import { formatPHP } from "@/lib/utils/format-php";
import { cn } from "@/lib/utils/cn";
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

const TENANT_STATUS_TONE: Record<string, "green" | "yellow" | "gray" | "red"> = {
  active: "green",
  prospect: "yellow",
  former: "gray",
  blacklisted: "red",
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

  // Progress bar for lease duration
  const totalDays = Math.max(1, stats.duration_days);
  const elapsedPct = Math.min(100, Math.max(0, Math.round((stats.days_elapsed / totalDays) * 100)));

  return (
    <div className="space-y-6">
      {/* Alert banner if expiring */}
      {stats.is_expiring_soon && (
        <div className="flex items-start gap-3 rounded-xl border border-warning-500/30 bg-warning-500/5 px-4 py-3 dark:border-warning-500/20 dark:bg-warning-500/[0.06]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-700 dark:text-warning-500" />
          <div>
            <p className="text-sm font-medium text-ink-900">
              This lease expires in {stats.days_remaining} day{stats.days_remaining === 1 ? "" : "s"}
            </p>
            <p className="mt-0.5 text-xs text-ink-500">
              Reach out to the tenant about renewal.
            </p>
          </div>
        </div>
      )}

      {/* Progress bar */}
      <Card>
        <CardBody className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-ink-800">Lease progress</span>
            <span className="text-ink-500">{elapsedPct}% elapsed</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-brand-gradient transition-all"
              style={{ width: elapsedPct + "%" }}
            />
          </div>
          <div className="flex justify-between text-xs text-ink-500">
            <span>{formatDate(lease.start_date)}</span>
            <span>{formatDate(lease.end_date)}</span>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Tenant */}
        <Card>
          <CardHeader
            title="Tenant"
            action={
              <Link href={"/property/tenants/" + lease.tenant_id}>
                <Button variant="secondary" size="sm">View profile</Button>
              </Link>
            }
          />
          <CardBody className="space-y-3 text-sm">
            <div className="flex items-center gap-3 border-b border-ink-100 pb-3 dark:border-white/[0.04]">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-accent-500 text-sm font-semibold text-white">
                {(lease.tenant_name ?? "?").split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink-900">{lease.tenant_name ?? "—"}</p>
                {lease.tenant_status && (
                  <StatusPill tone={TENANT_STATUS_TONE[lease.tenant_status] ?? "gray"} dot>
                    {lease.tenant_status}
                  </StatusPill>
                )}
              </div>
            </div>

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
            {lease.tenant_since && (
              <InfoRow
                icon={<Calendar className="h-3.5 w-3.5" />}
                label="Tenant since"
                value={formatDate(lease.tenant_since)}
              />
            )}
          </CardBody>
        </Card>

        {/* Unit + property */}
        <Card>
          <CardHeader
            title="Unit & property"
            action={
              lease.property_id ? (
                <Link href={"/property/properties/" + lease.property_id}>
                  <Button variant="secondary" size="sm">View property</Button>
                </Link>
              ) : undefined
            }
          />
          <CardBody className="space-y-3 text-sm">
            <InfoRow
              icon={<span className="text-xs font-semibold">U</span>}
              label="Unit"
              value={lease.unit_number ?? "—"}
              href={"/property/units/" + lease.unit_id}
            />
            <InfoRow
              icon={<span className="text-xs font-semibold">P</span>}
              label="Property"
              value={lease.property_name ?? "—"}
            />
            <InfoRow
              icon={<span className="text-xs font-semibold">A</span>}
              label="Address"
              value={lease.property_address ?? "—"}
            />
          </CardBody>
        </Card>

        {/* Terms */}
        <Card>
          <CardHeader title="Lease terms" />
          <CardBody className="space-y-3 text-sm">
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
              icon={<span className="text-xs font-semibold">T</span>}
              label="Term"
              value={lease.term ? (TERM_LABEL[lease.term] ?? lease.term) : "—"}
            />
            <InfoRow
              icon={<span className="text-xs font-semibold">I</span>}
              label="Intent"
              value={lease.intent ?? "—"}
            />
            <InfoRow
              icon={<span className="text-xs font-semibold">N</span>}
              label="Notice period"
              value={lease.notice_period_days + " days"}
            />
            <InfoRow
              icon={<span className="text-xs font-semibold">D</span>}
              label="Duration"
              value={Math.round(stats.duration_days / 30) + " months"}
            />
          </CardBody>
        </Card>

        {/* Financials */}
        <Card>
          <CardHeader title="Financials" />
          <CardBody className="space-y-3 text-sm">
            <InfoRow
              icon={<Banknote className="h-3.5 w-3.5" />}
              label="Monthly rent"
              value={formatPHP(lease.monthly_rent)}
            />
            <InfoRow
              icon={<Banknote className="h-3.5 w-3.5" />}
              label="1st deposit"
              value={formatPHP(lease.deposit_1 ?? 0)}
            />
            <InfoRow
              icon={<Banknote className="h-3.5 w-3.5" />}
              label="2nd deposit"
              value={formatPHP(lease.deposit_2 ?? 0)}
            />
            <InfoRow
              icon={<Banknote className="h-3.5 w-3.5" />}
              label="Add-ons amount"
              value={formatPHP(lease.ad_ons_amount ?? 0)}
            />
            <div className="border-t border-ink-100 pt-3 dark:border-white/[0.04]">
              <InfoRow
                icon={<CheckCircle2 className="h-3.5 w-3.5 text-success-500" />}
                label="Total paid"
                value={formatPHP(stats.total_paid)}
              />
              <InfoRow
                icon={<AlertTriangle className={cn("h-3.5 w-3.5", stats.outstanding > 0 ? "text-danger-500" : "text-ink-300")} />}
                label="Outstanding"
                value={formatPHP(stats.outstanding)}
                tone={stats.outstanding > 0 ? "danger" : "default"}
              />
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Add-ons */}
      {adOns.length > 0 && (
        <Card>
          <CardHeader title="Add-ons" />
          <CardBody>
            <div className="flex flex-wrap gap-2">
              {adOns.map((a, i) => (
                <StatusPill key={i} tone="brand">{a}</StatusPill>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Contract */}
      <Card>
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
              <InfoRow
                icon={<span className="text-xs font-semibold">T</span>}
                label="Template"
                value={contract.template_name ?? "—"}
              />
              <div className="flex items-center justify-between gap-4">
                <span className="text-ink-500">Status</span>
                <StatusPill tone={contract.status === "signed" ? "green" : "yellow"} dot>
                  {contract.status}
                </StatusPill>
              </div>
              {contract.signed_at && (
                <InfoRow
                  icon={<Calendar className="h-3.5 w-3.5" />}
                  label="Signed at"
                  value={formatDate(contract.signed_at)}
                />
              )}
              {contract.signed_document_url && (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-ink-500">Signed document</span>
                  <a
                    href={contract.signed_document_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
                  >
                    Open →
                  </a>
                </div>
              )}
            </div>
          ) : (
            <div className="py-6 text-center">
              <p className="mb-3 text-ink-500">No contract generated for this lease yet.</p>
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

function InfoRow({
  icon,
  label,
  value,
  href,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href?: string;
  tone?: "default" | "danger";
}) {
  const valueColor = tone === "danger" ? "text-danger-700 dark:text-danger-500" : "text-ink-900";
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="flex items-center gap-1.5 text-ink-500">
        <span className="text-ink-400">{icon}</span>
        {label}
      </span>
      {href ? (
        <Link href={href} className="text-right font-medium text-brand-600 hover:underline dark:text-brand-400">
          {value}
        </Link>
      ) : (
        <span className={cn("text-right font-medium capitalize", valueColor)}>{value}</span>
      )}
    </div>
  );
}
`;

// =============================================================================
// 3. Enhanced lease Activity tab — chronological timeline
// =============================================================================
FILES["src/components/lease/tabs/activity-tab.tsx"] =
`import {
  FileText,
  Receipt,
  CreditCard,
  ScrollText,
  CheckCircle2,
  AlertCircle,
  Info,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Card, CardBody } from "@/components/ui/card";
import { StatusPill } from "@/components/dashboard/status-pill";
import type { LeaseProfile } from "@/lib/db/lease-profile";

function iconForType(entity_type: string) {
  if (entity_type === "invoice") return Receipt;
  if (entity_type === "payment") return CreditCard;
  if (entity_type === "contract") return ScrollText;
  if (entity_type === "lease") return FileText;
  if (entity_type === "job_order") return Wrench;
  return FileText;
}

const ACTION_COLOR: Record<string, { bg: string; text: string; icon: React.ComponentType<{ className?: string }> }> = {
  create: { bg: "bg-success-500/10", text: "text-success-700 dark:text-success-500", icon: CheckCircle2 },
  update: { bg: "bg-info-500/10", text: "text-info-700 dark:text-info-500", icon: Info },
  delete: { bg: "bg-danger-500/10", text: "text-danger-700 dark:text-danger-500", icon: AlertCircle },
  archive: { bg: "bg-ink-100 dark:bg-white/[0.06]", text: "text-ink-600", icon: FileText },
};

function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return Math.floor(diff / 60) + "m ago";
  if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
  if (diff < 604800) return Math.floor(diff / 86400) + "d ago";
  return new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

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
      <CardBody>
        <ol className="relative space-y-4 pl-8">
          {/* Vertical line */}
          <div className="absolute left-3 top-2 bottom-2 w-px bg-ink-200 dark:bg-white/[0.08]" />

          {profile.activity.map((a) => {
            const color = ACTION_COLOR[a.action] ?? ACTION_COLOR.update;
            const TypeIcon = iconForType(a.entity_type);
            const ActionIcon = color.icon;
            return (
              <li key={a.id} className="relative">
                <div className={cn(
                  "absolute -left-8 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-surface",
                  color.bg
                )}>
                  <ActionIcon className={cn("h-3.5 w-3.5", color.text)} />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill tone="gray">
                    <TypeIcon className="mr-1 h-3 w-3" />
                    {a.entity_type.replace("_", " ")}
                  </StatusPill>
                  <span className="text-sm font-medium capitalize text-ink-800">
                    {a.action}
                  </span>
                  <span className="text-xs text-ink-400">
                    {relativeTime(a.created_at)}
                  </span>
                </div>

                {a.reason && (
                  <p className="mt-1 text-xs text-ink-500">{a.reason}</p>
                )}
              </li>
            );
          })}
        </ol>
      </CardBody>
    </Card>
  );
}
`;

// =============================================================================
// 4. Enhanced tenant Leases tab — expandable archive
// =============================================================================
FILES["src/components/tenant/tabs/leases-tab.tsx"] =
`"use client";

import { useState } from "react";
import Link from "next/link";
import {
  FileText,
  ChevronDown,
  Calendar,
  Banknote,
  Building2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Card, CardBody } from "@/components/ui/card";
import { StatusPill } from "@/components/dashboard/status-pill";
import { Button } from "@/components/ui/button";
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

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

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
    <div className="space-y-3">
      {profile.leases.map((lease) => (
        <TenantLeaseCard key={lease.id} lease={lease} />
      ))}
    </div>
  );
}

function TenantLeaseCard({ lease }: { lease: TenantProfile["leases"][number] }) {
  const [open, setOpen] = useState(false);
  const isCurrent = lease.status === "active" || lease.status === "expiring";

  const duration = Math.max(
    0,
    Math.ceil((new Date(lease.end_date).getTime() - new Date(lease.start_date).getTime()) / 86400000)
  );

  return (
    <Card className="overflow-hidden">
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
              Unit {lease.unit_number ?? "—"}
            </span>
            <StatusPill tone={STATUS_TONE[lease.status] ?? "gray"} dot>
              {lease.status}
            </StatusPill>
            {isCurrent && (
              <span className="text-xs font-medium text-brand-600 dark:text-brand-400">
                Current
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-500">
            <span>{formatDate(lease.start_date)} → {formatDate(lease.end_date)}</span>
            <span>·</span>
            <span>{Math.round(duration / 30)} months</span>
            {lease.property_name && (
              <>
                <span>·</span>
                <span>{lease.property_name}</span>
              </>
            )}
          </div>
        </div>

        <div className="hidden shrink-0 text-right md:block">
          <p className="text-sm font-semibold text-ink-900">{formatPHP(lease.monthly_rent)}</p>
          <p className="text-xs text-ink-500">monthly rent</p>
        </div>

        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-ink-400 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <CardBody className="space-y-5">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div>
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-500">
                Lease details
              </h4>
              <div className="space-y-2.5 text-sm">
                <Row icon={<Building2 className="h-3.5 w-3.5" />} label="Property" value={lease.property_name ?? "—"} />
                <Row icon={<Building2 className="h-3.5 w-3.5" />} label="Unit" value={lease.unit_number ?? "—"} />
                <Row icon={<Calendar className="h-3.5 w-3.5" />} label="Start" value={formatDate(lease.start_date)} />
                <Row icon={<Calendar className="h-3.5 w-3.5" />} label="End" value={formatDate(lease.end_date)} />
                {lease.move_in_date && (
                  <Row icon={<Calendar className="h-3.5 w-3.5" />} label="Move-in" value={formatDate(lease.move_in_date)} />
                )}
                {lease.due_date && (
                  <Row icon={<Calendar className="h-3.5 w-3.5" />} label="Rent due" value={formatDate(lease.due_date)} />
                )}
                <Row icon={<Banknote className="h-3.5 w-3.5" />} label="Term" value={lease.term ? (TERM_LABEL[lease.term] ?? lease.term) : "—"} />
                <Row icon={<Banknote className="h-3.5 w-3.5" />} label="Intent" value={lease.intent ?? "—"} />
              </div>
            </div>

            <div>
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-500">
                Financials
              </h4>
              <div className="space-y-2.5 text-sm">
                <Row icon={<Banknote className="h-3.5 w-3.5" />} label="Monthly rent" value={formatPHP(lease.monthly_rent)} />
                <Row icon={<Banknote className="h-3.5 w-3.5" />} label="Deposit" value={formatPHP(lease.deposit_amount)} />
                <Row
                  icon={<CheckCircle2 className="h-3.5 w-3.5 text-success-500" />}
                  label="Total paid"
                  value={formatPHP(
                    profile.payments
                      .filter((p) => {
                        const inv = profile.invoices.find((i) => i.id === p.invoice_id);
                        return inv?.lease_id === lease.id;
                      })
                      .reduce((s, p) => s + Number(p.amount ?? 0), 0)
                  )}
                />
                <Row
                  icon={<AlertTriangle className="h-3.5 w-3.5 text-warning-500" />}
                  label="Outstanding"
                  value={formatPHP(
                    profile.invoices
                      .filter((i) => i.lease_id === lease.id && (i.status === "unpaid" || i.status === "overdue"))
                      .reduce((s, i) => s + Number(i.amount ?? 0), 0)
                  )}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-ink-100 pt-4 dark:border-white/[0.04]">
            <Link href={"/property/leases/" + lease.id}>
              <Button variant="secondary" size="sm">
                <FileText className="mr-1.5 h-3.5 w-3.5" />
                Open lease profile
              </Button>
            </Link>
            <Link href={"/accounting/invoices?q=" + (lease.unit_number ?? "")}>
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

function Row({
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
      <span className="text-right font-medium capitalize text-ink-900">{value}</span>
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

  console.log("Lease archive — enhanced lease + tenant lease tabs\\n");

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
  console.log("\\nTest:");
  console.log("  - /property/leases/[id]            → richer Overview tab + timeline Activity");
  console.log("  - /property/tenants/[id] → Leases  → expandable archive");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});