import Link from "next/link";
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
