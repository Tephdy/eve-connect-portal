import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/guard";
import { listMeters } from "@/lib/db/utilities";
import { listProperties } from "@/lib/db/properties";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Card, CardBody } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { AddMeterDialog } from "@/components/utilities/add-meter-dialog";
import { MeterFilters } from "@/components/utilities/meter-filters";

export default async function MetersPage({
  searchParams,
}: {
  searchParams: Promise<{ property?: string; utility_type?: string }>;
}) {
  await requirePagePermission("utility:read");
  const sp = await searchParams;

  const [meters, properties] = await Promise.all([
    listMeters({
      property_id: sp.property ?? "all",
      utility_type: (sp.utility_type as never) ?? "all",
    }),
    listProperties(),
  ]);

  const supabase = await createClient();
  const { data: unitsRaw } = await supabase
    .from("unit")
    .select("id, unit_number, property_id")
    .order("unit_number");
  const units = (unitsRaw ?? []) as {
    id: string;
    unit_number: string;
    property_id: string | null;
  }[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meters"
        description="Electricity, water, and other meters by unit."
        action={
          <AddMeterDialog
            properties={properties.map((p) => ({ id: p.id, name: p.name }))}
            units={units}
          />
        }
      />

      <MeterFilters
        properties={properties.map((p) => ({ id: p.id, name: p.name }))}
      />

      {meters.length === 0 ? (
        <EmptyState
          title="No meters"
          description="Add a meter to a unit to start recording readings."
        />
      ) : (
        <Card className="overflow-hidden">
          <CardBody className="p-0">
            <Table>
              <THead>
                <TR>
                  <TH>Unit</TH>
                  <TH>Property</TH>
                  <TH>Type</TH>
                  <TH>Meter #</TH>
                  <TH className="text-right">Last reading</TH>
                  <TH>As of</TH>
                  <TH className="text-right"></TH>
                </TR>
              </THead>
              <TBody>
                {meters.map((m) => (
                  <TR key={m.id}>
                    <TD className="font-medium">{m.unit_number ?? "—"}</TD>
                    <TD className="text-ink-600">{m.property_name ?? "—"}</TD>
                    <TD className="capitalize">{m.utility_type}</TD>
                    <TD className="text-ink-600">{m.meter_number ?? "—"}</TD>
                    <TD className="text-right tabular-nums">
                      {m.last_reading != null
                        ? m.last_reading + " " + m.unit_label
                        : "—"}
                    </TD>
                    <TD className="text-xs text-ink-500">
                      {m.last_reading_date
                        ? new Date(m.last_reading_date).toLocaleDateString(
                            "en-PH"
                          )
                        : "—"}
                    </TD>
                    <TD className="text-right">
                      <Link
                        href={"/property/meters/" + m.id}
                        className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
                      >
                        Open
                      </Link>
                    </TD>
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
