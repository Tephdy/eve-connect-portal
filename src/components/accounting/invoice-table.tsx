import Link from "next/link";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatPHP } from "@/lib/utils/format-php";
import type { Invoice } from "@/lib/db/invoices";

const STATUS_TONE: Record<string, "gray" | "green" | "yellow" | "red"> = {
  unpaid: "yellow", paid: "green", overdue: "red", void: "gray",
};

export function InvoiceTable({ invoices }: { invoices: Invoice[] }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <Table>
        <THead>
          <TR>
            <TH>Invoice</TH><TH>Tenant</TH><TH>Unit</TH><TH>Type</TH>
            <TH className="text-right">Amount</TH><TH>Due</TH><TH>Status</TH>
          </TR>
        </THead>
        <TBody>
          {invoices.map((inv) => (
            <TR key={inv.id}>
              <TD className="font-medium">
                <Link href={"/accounting/invoices/" + inv.id} className="text-brand-600 hover:underline">
                  {inv.display_number ?? inv.id.slice(0, 8)}
                </Link>
              </TD>
              <TD className="text-gray-600">{inv.tenant_name ?? "—"}</TD>
              <TD className="text-gray-600">{inv.unit_number ?? "—"}</TD>
              <TD className="capitalize text-gray-600">{inv.type}</TD>
              <TD className="text-right">{formatPHP(inv.amount)}</TD>
              <TD className="text-xs text-gray-600">{inv.due_date}</TD>
              <TD><Badge tone={STATUS_TONE[inv.status] ?? "gray"}>{inv.status}</Badge></TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
