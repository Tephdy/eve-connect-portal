import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/guard";
import { listPayments } from "@/lib/db/payments";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { formatPHP } from "@/lib/utils/format-php";

export default async function PaymentsPage() {
  await requirePagePermission("payment:read");
  const payments = await listPayments();

  return (
    <div>
      <PageHeader
        title="Payments"
        description="All recorded payments with printable receipts."
      />
      {payments.length === 0 ? (
        <EmptyState
          title="No payments yet"
          description="Record payments from the invoice detail page."
        />
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <Table>
            <THead>
              <TR>
                <TH>Receipt</TH><TH>Invoice</TH><TH>Tenant</TH>
                <TH className="text-right">Amount</TH><TH>Method</TH><TH>Paid at</TH>
                <TH className="text-right"></TH>
              </TR>
            </THead>
            <TBody>
              {payments.map((p) => (
                <TR key={p.id}>
                  <TD className="font-medium">{p.receipt_number ?? "—"}</TD>
                  <TD>{p.invoice_display ?? "—"}</TD>
                  <TD className="text-gray-600">{p.tenant_name ?? "—"}</TD>
                  <TD className="text-right">{formatPHP(p.amount)}</TD>
                  <TD className="text-gray-600">{p.method}</TD>
                  <TD className="text-gray-600 text-xs">
                    {new Date(p.paid_at).toLocaleString("en-PH")}
                  </TD>
                  <TD className="text-right">
                    <Link
                      href={"/accounting/payments/" + p.id + "/receipt"}
                      className="text-brand-600 hover:underline text-sm"
                    >
                      Receipt
                    </Link>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}
    </div>
  );
}
