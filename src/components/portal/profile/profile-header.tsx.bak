import { Mail, Phone, MessageCircle, Wallet, Receipt, AlertCircle, PiggyBank } from "lucide-react";
import { StatusPill } from "@/components/dashboard/status-pill";
import { StatCard } from "@/components/dashboard/stat-card";
import { formatPHP } from "@/lib/utils/format-php";
import type { TenantProfile } from "@/lib/db/tenant-profile";
import Link from "next/link";

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

export function PortalProfileHeader({ profile }: { profile: TenantProfile }) {
  const { tenant, stats } = profile;

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-2xl bg-white p-5 shadow-sm dark:bg-[#111318]">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-gradient text-base font-bold text-white shadow-md shadow-brand-500/25">
            {initials(tenant.full_name)}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl font-semibold tracking-tight text-ink-900">
                {tenant.full_name}
              </h1>
              <StatusPill tone={STATUS_TONE[tenant.status] ?? "gray"} dot>
                {tenant.status}
              </StatusPill>
            </div>

            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-500">
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

          <Link
            href="/portal/profile/edit"
            className="shrink-0 self-start rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-700 transition-colors hover:border-brand-500 hover:text-brand-600 dark:border-white/[0.08] dark:bg-white/[0.02] dark:text-ink-300 dark:hover:border-brand-500 dark:hover:text-brand-400"
          >
            Edit profile
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Total invoiced"
          value={formatPHP(stats.total_invoiced)}
          accent="sky"
          icon={Receipt}
        />
        <StatCard
          label="Total paid"
          value={formatPHP(stats.total_paid)}
          accent="mint"
          icon={Wallet}
        />
        <StatCard
          label="Outstanding"
          value={formatPHP(stats.outstanding)}
          accent={stats.overdue_count > 0 ? "red" : "yellow"}
          deltaLabel={
            stats.overdue_count > 0 ? stats.overdue_count + " overdue" : "on track"
          }
          icon={AlertCircle}
        />
        <StatCard
          label="Deposit held"
          value={formatPHP(stats.deposit_held)}
          accent="lavender"
          icon={PiggyBank}
        />
      </div>
    </div>
  );
}