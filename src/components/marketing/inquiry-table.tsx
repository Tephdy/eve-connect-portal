import Link from "next/link";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { Inquiry } from "@/lib/db/inquiries";

const STATUS_TONE: Record<string, "gray" | "green" | "yellow" | "red"> = {
  open: "yellow", contacted: "blue" as any, converted: "green", lost: "red",
};

export function InquiryTable({ inquiries }: { inquiries: Inquiry[] }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <Table>
        <THead>
          <TR>
            <TH>Prospect</TH><TH>Contact</TH><TH>Unit</TH>
            <TH>Source</TH><TH>Status</TH><TH className="text-right">Actions</TH>
          </TR>
        </THead>
        <TBody>
          {inquiries.map((i) => (
            <TR key={i.id}>
              <TD className="font-medium">
                <Link href={"/marketing/inquiries/" + i.id} className="text-brand-600 hover:underline">
                  {i.prospect_name}
                </Link>
              </TD>
              <TD className="text-gray-600">{i.contact ?? "—"}</TD>
              <TD className="text-gray-600">{i.unit_number ?? "—"}</TD>
              <TD className="text-gray-600">{i.source ?? "—"}</TD>
              <TD><Badge tone={STATUS_TONE[i.status] ?? "gray"}>{i.status}</Badge></TD>
              <TD className="text-right">
                <Link href={"/marketing/inquiries/" + i.id} className="text-brand-600 hover:underline text-sm">
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
