import Link from "next/link";
import { ChevronRight, CalendarRange, Wallet } from "lucide-react";
import { requireTenantSelf } from "@/lib/auth/require-tenant-self";
import { listMyLeases } from "@/lib/db/tenant-portal";
import { PortalPageHeader } from "@/components/portal/portal-page-header";
import { formatPHP } from "@/lib/utils/format-php";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  active: "Active",
  expiring: "Expiring soon",
  ended: "Ended",
  terminated: "Terminated",
};

const STATUS_TONE: Record<string, string> = {
  draft: "bg-ink-500/10 text-ink-600 dark:text-ink-300",
  active: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  expiring: "bg-amber-500/10 text-amber-700 dark:text-amber-500",
  ended: "bg-ink-500/10 text-ink-500 dark:text-ink-400",
  terminated: "bg-danger-500/10 text-danger-700 dark:text-danger-500",
};

export default async function PortalLeaseListPage() {
  const { tenant } = await requireTenantSelf();
  const leases = await listMyLeases(tenant.id);

  if (leases.length === 0) {
    return (
      <div className="space-y-6">
        <PortalPageHeader
          title="My lease"
          description="Your lease agreement with Eve's Residences."
        />
        <div className="rounded-2xl border border-dashed border-ink-200 bg-white p-8 text-center dark:border-white/[0.08] dark:bg-[#111318]">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
            <CalendarRange className="h-6 w-6" />
          </div>
          <p className="mt-3 text-sm font-medium text-ink-900">
            No lease on record
          </p>
          <p className="mt-1 text-xs text-ink-500">
            Contact the management office if this seems wrong.
          </p>
        </div>
      </div>
    );
  }

  const activeLease = leases.find((l) => l.is_active);

  return (
    <div className="space-y-6">
      <PortalPageHeader
        title="My lease"
        description={
          leases.length === 1
            ? "Your current lease agreement"
            : leases.length + " leases on record"
        }
      />

      {activeLease && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-ink-200 bg-white p-4 shadow-sm dark:border-white/[0.06] dark:bg-[#111318]">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400">
              <Wallet className="h-4 w-4" />
            </div>
            <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-ink-400">
              Monthly rent
            </p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-ink-900">
              {formatPHP(activeLease.monthly_rent)}
            </p>
          </div>
          <div className="rounded-2xl border border-ink-200 bg-white p-4 shadow-sm dark:border-white/[0.06] dark:bg-[#111318]">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CalendarRange className="h-4 w-4" />
            </div>
            <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-ink-400">
              Lease ends
            </p>
            <p className="mt-0.5 text-sm font-semibold text-ink-900">
              {new Date(activeLease.end_date).toLocaleDateString("en-PH", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {leases.map((l) => (
          <Link
            key={l.id}
            href={"/portal/lease/" + l.id}
            className="group flex items-center gap-4 rounded-2xl border border-ink-200 bg-white p-4 shadow-sm transition-all hover:border-brand-500/60 hover:shadow-md active:scale-[0.99] dark:border-white/[0.06] dark:bg-[#111318]"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold text-ink-900">
                  {l.property_name ?? "Property"}
                </p>
                <span
                  className={
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide " +
                    (STATUS_TONE[l.status] ?? "bg-ink-500/10 text-ink-600")
                  }
                >
                  {STATUS_LABEL[l.status] ?? l.status}
                </span>
              </div>
              {l.unit_number && (
                <p className="mt-0.5 text-xs text-ink-500">Unit {l.unit_number}</p>
              )}
              <p className="mt-1.5 text-xs text-ink-500">
                {new Date(l.start_date).toLocaleDateString("en-PH", {
                  month: "short",
                  year: "numeric",
                })}{" "}
                &rarr;{" "}
                {new Date(l.end_date).toLocaleDateString("en-PH", {
                  month: "short",
                  year: "numeric",
                })}
              </p>
              <p className="mt-2 text-sm font-semibold tabular-nums text-ink-800">
                {formatPHP(l.monthly_rent)}
                <span className="text-xs font-normal text-ink-400">
                  {" "}
                  / month
                </span>
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-ink-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-500" />
          </Link>
        ))}
      </div>
    </div>
  );
}
