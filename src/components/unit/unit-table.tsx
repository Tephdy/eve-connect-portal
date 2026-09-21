import Link from "next/link";
import { DoorOpen } from "lucide-react";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Card, CardBody } from "@/components/ui/card";
import { StatusPill } from "@/components/dashboard/status-pill";
import { formatPHP } from "@/lib/utils/format-php";
import type { Unit } from "@/lib/db/units";

const STATUS_TONE: Record<string, "green" | "brand" | "yellow" | "red" | "gray"> = {
  vacant: "green",
  occupied: "brand",
  reserved: "yellow",
  maintenance: "red",
  unavailable: "gray",
};

export function UnitTable({
  units,
  showFooterCount,
}: {
  units: Unit[];
  showFooterCount?: boolean;
}) {
  return (
    <Card className="overflow-hidden">
      <CardBody className="p-0">
        <Table>
          <THead>
            <TR>
              <TH>Unit</TH>
              <TH>Property</TH>
              <TH>Layout</TH>
              <TH className="text-right">Rent</TH>
              <TH>Status</TH>
              <TH className="text-right"></TH>
            </TR>
          </THead>
          <TBody>
            {units.map((u) => (
              <TR key={u.id}>
                <TD>
                  <Link
                    href={"/property/units/" + u.id}
                    className="flex items-center gap-3 group"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400">
                      <DoorOpen className="h-4 w-4" />
                    </div>
                    <span className="font-medium text-ink-900 group-hover:text-brand-600 dark:group-hover:text-brand-400">
                      {u.unit_number}
                    </span>
                  </Link>
                </TD>
                <TD className="text-ink-600">{u.property_name ?? "—"}</TD>
                <TD className="text-ink-600">
                  {u.bedrooms != null ? u.bedrooms + "BR" : "—"}
                  {u.area_sqm != null ? " · " + u.area_sqm + " sqm" : ""}
                </TD>
                <TD className="text-right font-medium text-ink-900">
                  {u.base_rent != null ? formatPHP(u.base_rent) : "—"}
                </TD>
                <TD>
                  <StatusPill tone={STATUS_TONE[u.status] ?? "gray"} dot>
                    {u.status}
                  </StatusPill>
                </TD>
                <TD className="text-right">
                  <Link
                    href={"/property/units/" + u.id}
                    className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
                  >
                    Edit
                  </Link>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </CardBody>
      {showFooterCount && (
        <div className="border-t border-ink-200 px-5 py-3 text-xs text-ink-500 dark:border-white/[0.06]">
          {units.length} row{units.length === 1 ? "" : "s"}
        </div>
      )}
    </Card>
  );
}
