import Link from "next/link";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatPHP } from "@/lib/utils/format-php";
import type { Unit } from "@/lib/db/units";

const STATUS_TONE: Record<string, "green" | "blue" | "yellow" | "red" | "gray"> = {
  vacant: "green", occupied: "blue", reserved: "yellow",
  maintenance: "red", unavailable: "gray",
};

export function UnitTable({ units }: { units: Unit[] }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <Table>
        <THead>
          <TR>
            <TH>Unit</TH><TH>Property</TH><TH>Layout</TH>
            <TH className="text-right">Rent</TH><TH>Status</TH>
            <TH className="text-right">Actions</TH>
          </TR>
        </THead>
        <TBody>
          {units.map((u) => (
            <TR key={u.id}>
              <TD className="font-medium">
                <Link href={"/property/units/" + u.id} className="text-brand-600 hover:underline">
                  {u.unit_number}
                </Link>
              </TD>
              <TD className="text-gray-600">{u.property_name ?? "—"}</TD>
              <TD className="text-gray-600">
                {u.bedrooms != null ? u.bedrooms + "BR" : "—"} · {u.area_sqm != null ? u.area_sqm + " sqm" : "—"}
              </TD>
              <TD className="text-right">{u.base_rent != null ? formatPHP(u.base_rent) : "—"}</TD>
              <TD><Badge tone={STATUS_TONE[u.status] ?? "gray"}>{u.status}</Badge></TD>
              <TD className="text-right">
                <Link href={"/property/units/" + u.id} className="text-brand-600 hover:underline text-sm">
                  Edit
                </Link>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
