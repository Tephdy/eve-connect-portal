import { requirePagePermission } from "@/lib/auth/guard";
import { listProperties } from "@/lib/db/properties";
import { getSpreadsheetRows } from "@/lib/db/spreadsheet";
import { PageHeader } from "@/components/layout/page-header";
import { SpreadsheetTabs } from "@/components/accounting/spreadsheet-tabs";
import { SpreadsheetToolbar } from "@/components/accounting/spreadsheet-toolbar";
import { SpreadsheetGrid } from "@/components/accounting/spreadsheet-grid";

export default async function SpreadsheetPage({
  searchParams,
}: {
  searchParams: Promise<{ property?: string; month?: string }>;
}) {
  await requirePagePermission("report:read");
  const sp = await searchParams;

  const properties = await listProperties();
  if (properties.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Spreadsheet" description="No properties configured." />
      </div>
    );
  }

  const property_id = sp.property ?? properties[0].id;
  const month = sp.month ?? new Date().toISOString().slice(0, 7);

  const result = await getSpreadsheetRows(property_id, month);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Spreadsheet"
        description="Per-property detail of every active lease, invoice, and payment."
        action={<SpreadsheetToolbar property_id={property_id} />}
      />

      <SpreadsheetTabs
        properties={properties.map((p) => ({ id: p.id, name: p.name }))}
      />

      <SpreadsheetGrid initial={result} property_id={property_id} />
    </div>
  );
}
