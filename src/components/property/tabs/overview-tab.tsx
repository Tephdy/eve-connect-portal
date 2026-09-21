import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { formatPHP } from "@/lib/utils/format-php";
import type { PropertyProfile } from "@/lib/db/property-profile";

export function PropertyOverviewTab({ profile }: { profile: PropertyProfile }) {
  const { property, stats } = profile;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader title="Property details" />
        <CardBody className="space-y-3 text-sm">
          <Row label="Name" value={property.name} />
          <Row label="Address" value={property.address ?? "—"} />
          <Row label="Type" value={property.type} />
          <Row label="Total units" value={String(property.total_units)} />
          <Row label="Created" value={new Date(property.created_at).toLocaleDateString("en-PH")} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Occupancy breakdown" />
        <CardBody className="space-y-3 text-sm">
          <Row label="Occupied" value={String(stats.occupied)} />
          <Row label="Vacant" value={String(stats.vacant)} />
          <Row label="Maintenance" value={String(stats.maintenance)} />
          <Row label="Occupancy rate" value={stats.occupancy_pct + "%"} />
          <Row label="Active leases" value={String(stats.active_leases)} />
        </CardBody>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader title="Revenue summary" />
        <CardBody>
          <div className="grid grid-cols-2 gap-6 md:grid-cols-3">
            <Summary label="Monthly revenue" value={formatPHP(stats.monthly_revenue)} />
            <Summary label="Yearly (est.)" value={formatPHP(stats.monthly_revenue * 12)} />
            <Summary label="Average per unit" value={formatPHP(stats.total_units > 0 ? stats.monthly_revenue / stats.total_units : 0)} />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
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
