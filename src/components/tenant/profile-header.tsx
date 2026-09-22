import Link from "next/link";
import { Mail, Phone, MessageCircle, ArrowLeft, Pencil } from "lucide-react";
import { StatusPill } from "@/components/dashboard/status-pill";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { formatPHP } from "@/lib/utils/format-php";
import type { TenantProfile } from "@/lib/db/tenant-profile";
import { Wallet, Receipt, AlertCircle, PiggyBank } from "lucide-react";

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

      <div className="glass flex flex-wrap items-start gap-5 rounded-3xl p-6">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-brand-gradient text-lg font-bold text-white shadow-lg shadow-brand-500/30">
          {initials(tenant.full_name)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-ink-900">
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

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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
          deltaLabel={stats.overdue_count > 0 ? stats.overdue_count + " overdue" : "on track"}
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
