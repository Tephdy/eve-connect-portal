"use client";

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
  return new Date(iso).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Compute per-lease totals from the tenant's full profile.
 */
function leaseTotals(
  leaseId: string,
  profile: TenantProfile
): { totalPaid: number; outstanding: number } {
  const invoices = profile.invoices.filter((i) => i.lease_id === leaseId);
  const invoiceIds = new Set(invoices.map((i) => i.id));

  const totalPaid = profile.payments
    .filter((p) => invoiceIds.has(p.invoice_id))
    .reduce((s, p) => s + Number(p.amount ?? 0), 0);

  const outstanding = invoices
    .filter((i) => i.status === "unpaid" || i.status === "overdue")
    .reduce((s, i) => s + Number(i.amount ?? 0), 0);

  return { totalPaid, outstanding };
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
        <TenantLeaseCard
          key={lease.id}
          lease={lease}
          profile={profile}
        />
      ))}
    </div>
  );
}

function TenantLeaseCard({
  lease,
  profile,
}: {
  lease: TenantProfile["leases"][number];
  profile: TenantProfile;
}) {
  const [open, setOpen] = useState(false);
  const isCurrent = lease.status === "active" || lease.status === "expiring";

  const duration = Math.max(
    0,
    Math.ceil(
      (new Date(lease.end_date).getTime() - new Date(lease.start_date).getTime()) /
        86400000
    )
  );

  const { totalPaid, outstanding } = leaseTotals(lease.id, profile);

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
            <span>
              {formatDate(lease.start_date)} → {formatDate(lease.end_date)}
            </span>
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

      {open && (
        <CardBody className="space-y-5">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div>
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-500">
                Lease details
              </h4>
              <div className="space-y-2.5 text-sm">
                <Row
                  icon={<Building2 className="h-3.5 w-3.5" />}
                  label="Property"
                  value={lease.property_name ?? "—"}
                />
                <Row
                  icon={<Building2 className="h-3.5 w-3.5" />}
                  label="Unit"
                  value={lease.unit_number ?? "—"}
                />
                <Row
                  icon={<Calendar className="h-3.5 w-3.5" />}
                  label="Start"
                  value={formatDate(lease.start_date)}
                />
                <Row
                  icon={<Calendar className="h-3.5 w-3.5" />}
                  label="End"
                  value={formatDate(lease.end_date)}
                />
                {lease.move_in_date && (
                  <Row
                    icon={<Calendar className="h-3.5 w-3.5" />}
                    label="Move-in"
                    value={formatDate(lease.move_in_date)}
                  />
                )}
                {lease.due_date && (
                  <Row
                    icon={<Calendar className="h-3.5 w-3.5" />}
                    label="Rent due"
                    value={formatDate(lease.due_date)}
                  />
                )}
                <Row
                  icon={<Banknote className="h-3.5 w-3.5" />}
                  label="Term"
                  value={lease.term ? TERM_LABEL[lease.term] ?? lease.term : "—"}
                />
                <Row
                  icon={<Banknote className="h-3.5 w-3.5" />}
                  label="Intent"
                  value={lease.intent ?? "—"}
                />
              </div>
            </div>

            <div>
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-500">
                Financials
              </h4>
              <div className="space-y-2.5 text-sm">
                <Row
                  icon={<Banknote className="h-3.5 w-3.5" />}
                  label="Monthly rent"
                  value={formatPHP(lease.monthly_rent)}
                />
                <Row
                  icon={<Banknote className="h-3.5 w-3.5" />}
                  label="Deposit"
                  value={formatPHP(lease.deposit_amount)}
                />
                <Row
                  icon={<CheckCircle2 className="h-3.5 w-3.5 text-success-500" />}
                  label="Total paid"
                  value={formatPHP(totalPaid)}
                />
                <Row
                  icon={<AlertTriangle className="h-3.5 w-3.5 text-warning-500" />}
                  label="Outstanding"
                  value={formatPHP(outstanding)}
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