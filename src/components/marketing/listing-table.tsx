import Link from "next/link";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatPHP } from "@/lib/utils/format-php";
import type { Listing } from "@/lib/db/listings";

const STATUS_TONE: Record<string, "gray" | "green" | "yellow"> = {
  draft: "gray", published: "green", unlisted: "yellow",
};

export function ListingTable({ listings }: { listings: Listing[] }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <Table>
        <THead>
          <TR>
            <TH>Title</TH><TH>Unit</TH><TH>Property</TH>
            <TH className="text-right">Asking</TH><TH>Status</TH>
            <TH className="text-right">Actions</TH>
          </TR>
        </THead>
        <TBody>
          {listings.map((l) => (
            <TR key={l.id}>
              <TD className="font-medium">
                <Link href={"/marketing/listings/" + l.id} className="text-brand-600 hover:underline">
                  {l.title}
                </Link>
              </TD>
              <TD className="text-gray-600">{l.unit_number ?? "—"}</TD>
              <TD className="text-gray-600">{l.property_name ?? "—"}</TD>
              <TD className="text-right">{l.asking_rent != null ? formatPHP(l.asking_rent) : "—"}</TD>
              <TD><Badge tone={STATUS_TONE[l.status] ?? "gray"}>{l.status}</Badge></TD>
              <TD className="text-right">
                <Link href={"/marketing/listings/" + l.id} className="text-brand-600 hover:underline text-sm">
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
