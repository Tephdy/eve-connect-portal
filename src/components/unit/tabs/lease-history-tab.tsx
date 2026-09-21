"use client";

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
