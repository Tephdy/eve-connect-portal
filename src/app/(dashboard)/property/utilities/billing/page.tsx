import { requirePagePermission } from "@/lib/auth/guard";
import { computeCharges } from "@/lib/db/utilities";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { formatPHP } from "@/lib/utils/format-php";
import { GenerateBillsButton } from "@/components/utilities/generate-bills-button";

export default async function UtilityBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  await requirePagePermission("utility:read");
  const sp = await searchParams;
  const month = sp.month ?? new Date().toISOString().slice(0, 7);
  const charges = await computeCharges(month);
  const total = charges.reduce((s, c) => s + c.amount, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Utility billing"
        description={"Charges for " + month}
        action={<GenerateBillsButton month={month} />}
      />

      <Card>
        <CardHeader title={"Total: " + formatPHP(total)} description={charges.length + " line(s)"} />
        <CardBody className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Unit</TH>
                <TH>Type</TH>
                <TH className="text-right">Prev</TH>
                <TH className="text-right">Current</TH>
                <TH className="text-right">Consumed</TH>
                <TH className="text-right">Rate</TH>
                <TH className="text-right">Amount</TH>
                <TH>Warning</TH>
              </TR>
            </THead>
            <TBody>
              {charges.map((c) => (
                <TR key={c.meter_id}>
                  <TD className="font-medium">{c.unit_number ?? "—"}</TD>
                  <TD className="capitalize">{c.utility_type}</TD>
                  <TD className="text-right tabular-nums">{c.previous_reading}</TD>
                  <TD className="text-right tabular-nums">{c.current_reading}</TD>
                  <TD className="text-right tabular-nums">
                    {c.consumption.toFixed(2)} {c.unit_label}
                  </TD>
                  <TD className="text-right tabular-nums">
                    {c.rate_per_unit != null ? formatPHP(c.rate_per_unit) : "—"}
                  </TD>
                  <TD className="text-right font-medium">{formatPHP(c.amount)}</TD>
                  <TD className="text-xs text-danger-600">{c.warning ?? ""}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );
}
