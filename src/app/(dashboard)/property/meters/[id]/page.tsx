import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/guard";
import { getMeter, listReadings } from "@/lib/db/utilities";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { RecordReadingForm } from "@/components/utilities/record-reading-form";

export default async function MeterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("utility:read");
  const { id } = await params;
  const meter = await getMeter(id);
  if (!meter) notFound();
  const readings = await listReadings(id);

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          (meter.meter_number ?? "Meter") + " · " + meter.utility_type
        }
        description={"Unit " + (meter.unit_number ?? meter.unit_id.slice(0, 8))}
      />

      <Card>
        <CardHeader title="Readings" />
        <CardBody className="border-b border-white/40 dark:border-white/[0.06]"><RecordReadingForm meter_id={meter.id} /></CardBody>
        <CardBody className="p-0">
          {readings.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-ink-500">
              No readings recorded yet.
            </div>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Date</TH>
                  <TH className="text-right">Reading</TH>
                  <TH className="text-right">Consumption</TH>
                  <TH>Notes</TH>
                </TR>
              </THead>
              <TBody>
                {readings.map((r, i) => {
                  const prev = readings[i + 1];
                  const delta = prev ? Number(r.reading) - Number(prev.reading) : null;
                  return (
                    <TR key={r.id}>
                      <TD className="text-sm">
                        {new Date(r.reading_date).toLocaleDateString("en-PH")}
                      </TD>
                      <TD className="text-right tabular-nums">
                        {Number(r.reading).toFixed(2)} {meter.unit_label}
                      </TD>
                      <TD className="text-right tabular-nums">
                        {delta != null ? delta.toFixed(2) : "—"}
                      </TD>
                      <TD className="text-sm text-ink-500">{r.notes ?? "—"}</TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
