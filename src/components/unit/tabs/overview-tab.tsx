import { Card, CardBody, CardHeader } from "@/components/ui/card";
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
