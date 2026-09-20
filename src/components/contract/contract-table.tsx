import Link from "next/link";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { Contract } from "@/lib/db/contracts";

const STATUS_TONE: Record<string, "gray" | "green" | "yellow" | "red"> = {
  draft: "gray", sent: "yellow", signed: "green", void: "red",
};

export function ContractTable({ contracts }: { contracts: Contract[] }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <Table>
        <THead>
          <TR>
            <TH>Unit</TH><TH>Tenant</TH><TH>Template</TH>
            <TH>Status</TH><TH>Created</TH>
            <TH className="text-right">Actions</TH>
          </TR>
        </THead>
        <TBody>
          {contracts.map((c) => (
            <TR key={c.id}>
              <TD className="font-medium">
                <Link href={"/property/contracts/" + c.id} className="text-brand-600 hover:underline">
                  {c.unit_number ?? "—"}
                </Link>
              </TD>
              <TD className="text-gray-600">{c.tenant_name ?? "—"}</TD>
              <TD className="text-gray-600">{c.template_name ?? "—"}</TD>
              <TD><Badge tone={STATUS_TONE[c.status] ?? "gray"}>{c.status}</Badge></TD>
              <TD className="text-gray-600 text-xs">
                {new Date(c.created_at).toLocaleDateString("en-PH")}
              </TD>
              <TD className="text-right">
                <Link href={"/property/contracts/" + c.id} className="text-brand-600 hover:underline text-sm">
                  View
                </Link>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
