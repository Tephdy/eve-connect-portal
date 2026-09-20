import Link from "next/link";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { Property } from "@/lib/db/properties";

const TYPE_TONE: Record<string, "blue" | "purple" | "gray"> = {
  residential: "blue",
  commercial:  "purple",
  mixed:       "gray",
};

export function PropertyTable({ properties }: { properties: Property[] }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <Table>
        <THead>
          <TR>
            <TH>Name</TH>
            <TH>Type</TH>
            <TH>Address</TH>
            <TH className="text-right">Units</TH>
            <TH className="text-right">Actions</TH>
          </TR>
        </THead>
        <TBody>
          {properties.map((p) => (
            <TR key={p.id}>
              <TD className="font-medium">
                <Link
                  href={"/property/properties/" + p.id}
                  className="text-brand-600 hover:underline"
                >
                  {p.name}
                </Link>
              </TD>
              <TD>
                <Badge tone={TYPE_TONE[p.type] ?? "gray"}>{p.type}</Badge>
              </TD>
              <TD className="text-gray-600">{p.address ?? "—"}</TD>
              <TD className="text-right">{p.total_units}</TD>
              <TD className="text-right">
                <Link
                  href={"/property/properties/" + p.id}
                  className="text-brand-600 hover:underline text-sm"
                >
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
