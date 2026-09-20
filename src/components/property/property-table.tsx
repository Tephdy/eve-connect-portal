import Link from "next/link";
import { Building2, MapPin } from "lucide-react";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Card, CardBody } from "@/components/ui/card";
import { StatusPill } from "@/components/dashboard/status-pill";
import type { Property } from "@/lib/db/properties";

const TYPE_TONE: Record<string, "brand" | "purple" | "gray"> = {
  studio_unit:     "brand",
  one_two_bedroom: "purple",
  bedspace:        "gray",
};

const TYPE_LABEL: Record<string, string> = {
  studio_unit:     "Studio Unit",
  one_two_bedroom: "1 & 2 Bedroom",
  bedspace:        "Bedspace",
};

export function PropertyTable({ properties }: { properties: Property[] }) {
  return (
    <Card className="overflow-hidden">
      <CardBody className="p-0">
        <Table>
          <THead>
            <TR>
              <TH>Property</TH>
              <TH>Type</TH>
              <TH>Address</TH>
              <TH className="text-right">Units</TH>
              <TH className="text-right"></TH>
            </TR>
          </THead>
          <TBody>
            {properties.map((p) => (
              <TR key={p.id}>
                <TD>
                  <Link
                    href={"/property/properties/" + p.id}
                    className="flex items-center gap-3 group"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <span className="font-medium text-ink-900 group-hover:text-brand-600 dark:group-hover:text-brand-400">
                      {p.name}
                    </span>
                  </Link>
                </TD>
                <TD>
                  <StatusPill tone={TYPE_TONE[p.type] ?? "gray"}>
                    {TYPE_LABEL[p.type] ?? p.type}
                  </StatusPill>
                </TD>
                <TD>
                  <span className="flex items-center gap-1.5 text-sm text-ink-500">
                    {p.address ? (
                      <>
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate max-w-md">{p.address}</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </span>
                </TD>
                <TD className="text-right font-medium text-ink-900">
                  {p.total_units}
                </TD>
                <TD className="text-right">
                  <Link
                    href={"/property/properties/" + p.id}
                    className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
                  >
                    View
                  </Link>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </CardBody>
    </Card>
  );
}
