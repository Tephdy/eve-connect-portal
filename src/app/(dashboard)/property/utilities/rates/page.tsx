import { requirePagePermission } from "@/lib/auth/guard";
import { listRates } from "@/lib/db/utilities";
import { listProperties } from "@/lib/db/properties";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { AddRateDialog } from "@/components/utilities/add-rate-dialog";
import { formatPHP } from "@/lib/utils/format-php";

export default async function RatesPage() {
  await requirePagePermission("utility:read");
  const [rates, properties] = await Promise.all([
    listRates(),
    listProperties(),
  ]);
  const propMap = new Map(properties.map((p) => [p.id, p.name]));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Utility rates"
        description="₱ per unit (kWh, m³, etc.) by property and effective date."
        action={
          <AddRateDialog
            properties={properties.map((p) => ({ id: p.id, name: p.name }))}
          />
        }
      />

      {rates.length === 0 ? (
        <Card><CardBody className="py-12 text-center text-sm text-ink-500">
          No rates configured yet. Click "Add rate" to start.
        </CardBody></Card>
      ) : (
        <Card className="overflow-hidden">
          <CardBody className="p-0">
            <Table>
              <THead>
                <TR>
                  <TH>Property</TH>
                  <TH>Utility</TH>
                  <TH className="text-right">Rate</TH>
                  <TH>Effective from</TH>
                  <TH>Effective to</TH>
                </TR>
              </THead>
              <TBody>
                {rates.map((r) => (
                  <TR key={r.id}>
                    <TD>{r.property_id ? propMap.get(r.property_id) ?? "—" : "All properties"}</TD>
                    <TD className="capitalize">{r.utility_type}</TD>
                    <TD className="text-right font-medium tabular-nums">{formatPHP(r.rate_per_unit)}</TD>
                    <TD className="text-sm">{r.effective_from}</TD>
                    <TD className="text-sm">{r.effective_to ?? "active"}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
