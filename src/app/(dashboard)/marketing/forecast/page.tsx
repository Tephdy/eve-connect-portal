import { requirePagePermission } from "@/lib/auth/guard";
import { listForecasts } from "@/lib/db/forecast";
import { listUnits } from "@/lib/db/units";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { ForecastTable } from "@/components/marketing/forecast-table";

export default async function ForecastPage() {
  await requirePagePermission("forecast:read");
  const [forecasts, units] = await Promise.all([listForecasts(), listUnits()]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Availability Forecast"
        description="Earliest available date per unit."
      />
      {units.length === 0 ? (
        <EmptyState title="No units" description="Add units first." />
      ) : (
        <ForecastTable forecasts={forecasts} units={units} />
      )}
    </div>
  );
}
