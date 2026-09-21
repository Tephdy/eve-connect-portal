import Link from "next/link";
import { Building2, MapPin, ArrowLeft, Pencil } from "lucide-react";
import { StatusPill } from "@/components/dashboard/status-pill";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { formatPHP } from "@/lib/utils/format-php";
import type { PropertyProfile } from "@/lib/db/property-profile";

const TYPE_TONE: Record<string, "brand" | "purple" | "gray"> = {
  residential: "brand",
  commercial: "purple",
  mixed: "gray",
};

const TYPE_LABEL: Record<string, string> = {
  residential: "Residential",
  commercial: "Commercial",
  mixed: "Mixed",
};

export function PropertyProfileHeader({ profile }: { profile: PropertyProfile }) {
  const { property, stats } = profile;

  return (
    <div className="space-y-6">
      <Link
        href="/property/properties"
        className="inline-flex items-center gap-1.5 text-sm text-ink-500 transition-colors hover:text-ink-800"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All properties
      </Link>

      <div className="flex flex-wrap items-start gap-5 rounded-xl border border-ink-200 bg-surface p-6 dark:border-white/[0.06]">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 text-white shadow-sm">
          <Building2 className="h-7 w-7" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-ink-900">
              {property.name}
            </h1>
            <StatusPill tone={TYPE_TONE[property.type] ?? "gray"}>
              {TYPE_LABEL[property.type] ?? property.type}
            </StatusPill>
          </div>

          {property.address && (
            <div className="mt-3 flex items-center gap-1.5 text-sm text-ink-600">
              <MapPin className="h-3.5 w-3.5 text-ink-400" />
              {property.address}
            </div>
          )}
        </div>

        <Link href={"/property/properties/" + property.id + "/edit"}>
          <Button variant="secondary">
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Edit
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total units" value={stats.total_units} accent="brand" />
        <StatCard label="Occupancy" value={stats.occupancy_pct + "%"} accent="green" deltaLabel={stats.occupied + " occupied"} />
        <StatCard label="Active leases" value={stats.active_leases} accent="purple" />
        <StatCard label="Monthly revenue" value={formatPHP(stats.monthly_revenue)} accent="yellow" />
      </div>
    </div>
  );
}
