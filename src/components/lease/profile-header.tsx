import Link from "next/link";
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
