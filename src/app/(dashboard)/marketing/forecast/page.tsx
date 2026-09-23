import { requirePagePermission } from "@/lib/auth/guard";
import { listForecasts } from "@/lib/db/forecast";
import { listUnits } from "@/lib/db/units";
import { listProperties } from "@/lib/db/properties";
import { listInquiries } from "@/lib/db/inquiries";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { ForecastTable } from "@/components/marketing/forecast-table";
import { ForecastFilters } from "@/components/marketing/forecast-filters";

export default async function ForecastPage({
  searchParams,
}: {
  searchParams: Promise<{ property?: string }>;
}) {
  await requirePagePermission("forecast:read");
  const sp = await searchParams;

  const [forecasts, allUnits, properties, inquiriesAll] = await Promise.all([
    listForecasts(),
    listUnits(),
    listProperties(),
    listInquiries(),
  ]);

  // Only open / contacted / converted inquiries are candidates for reservation.
  const inquiries = (inquiriesAll as any[]).filter((i) =>
    ["open", "contacted", "converted"].includes(i.status)
  );

  // Filter units by the selected property (if any).
  // Unit already carries property_id, so this is a JS filter — no extra query.
  const selectedPropertyId =
    sp.property && sp.property !== "all" ? sp.property : null;

  const units = selectedPropertyId
    ? (allUnits as any[]).filter(
        (u) => u.property_id === selectedPropertyId
      )
    : allUnits;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Availability Forecast"
        description="Earliest available date per unit."
      />

      <ForecastFilters
        properties={properties.map((p) => ({ id: p.id, name: p.name }))}
      />

      {units.length === 0 ? (
        <EmptyState
          title="No units"
          description={
            selectedPropertyId
              ? "No units in this property."
              : "Add units first."
          }
        />
      ) : (
        <ForecastTable forecasts={forecasts} units={units} inquiries={inquiries} />
      )}
    </div>
  );
}
