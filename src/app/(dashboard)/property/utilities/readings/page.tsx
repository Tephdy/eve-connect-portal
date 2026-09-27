import { requirePagePermission } from "@/lib/auth/guard";
import { listProperties } from "@/lib/db/properties";
import { listBillingRowsForProperty } from "@/lib/db/utilities";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Card, CardBody } from "@/components/ui/card";
import { ReadingsGrid } from "@/components/utilities/readings-grid";
import { UtilityTypeTabs } from "@/components/utilities/utility-type-tabs";
import { PropertyPicker } from "@/components/utilities/property-picker";

export default async function ReadingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    property?: string;
    type?: string;
    date?: string;
  }>;
}) {
  await requirePagePermission("utility:read");
  const sp = await searchParams;
  const properties = await listProperties();

  if (properties.length === 0) {
    return (
      <EmptyState title="No properties" description="Create a property first." />
    );
  }

  const propertyId = sp.property ?? properties[0].id;
  const utilityType =
    sp.type === "electricity" ? "electricity" : ("water" as const);
  const asOf = sp.date ?? new Date().toISOString().slice(0, 10);

  const { rows, rate, rate_warning } = await listBillingRowsForProperty(
    propertyId,
    utilityType,
    asOf
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meter readings"
        description="Record current readings, compute consumption, and issue invoices."
      />

      <div className="flex flex-wrap items-center gap-3">
        <PropertyPicker
          properties={properties.map((p) => ({ id: p.id, name: p.name }))}
          value={propertyId}
        />
        <UtilityTypeTabs value={utilityType} />
      </div>

      <Card className="overflow-hidden">
        <CardBody className="p-0">
          <ReadingsGrid
            propertyId={propertyId}
            utilityType={utilityType}
            asOfDate={asOf}
            ratePerUnit={rate}
            rateWarning={rate_warning}
            rows={rows}
          />
        </CardBody>
      </Card>
    </div>
  );
}
