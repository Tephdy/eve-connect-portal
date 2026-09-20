import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/guard";
import { getInvoice } from "@/lib/db/invoices";
import { listPaymentsForInvoice } from "@/lib/db/payments";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { formatPHP } from "@/lib/utils/format-php";
import { PaymentForm } from "@/components/accounting/payment-form";
import { VoidInvoiceButton } from "@/components/accounting/void-invoice-button";

const STATUS_TONE: Record<string, "gray" | "green" | "yellow" | "red"> = {
  unpaid: "yellow", paid: "green", overdue: "red", void: "gray",
};

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("invoice:read");
  const { id } = await params;
  const invoice = await getInvoice(id);
  if (!invoice) notFound();
  const payments = await listPaymentsForInvoice(id);

  const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div>
      <PageHeader
        title={invoice.display_number ?? "Invoice"}
        description={
          (invoice.tenant_name ?? "") +
          (invoice.unit_number ? " · Unit " + invoice.unit_number : "")
        }
        action={<Badge tone={STATUS_TONE[invoice.status] ?? "gray"}>{invoice.status}</Badge>}
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader title="Details" />
            <CardBody className="text-sm space-y-2">
              <Row label="Type" value={invoice.type} />
              <Row label="Amount" value={formatPHP(invoice.amount)} />
              <Row label="Paid so far" value={formatPHP(totalPaid)} />
              <Row label="Due date" value={invoice.due_date} />
              <Row label="Status" value={invoice.status} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Payments" description={payments.length + " recorded"} />
            <CardBody>
              {payments.length === 0 ? (
                <p className="text-sm text-ink-500">No payments yet.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {payments.map((p) => (
                    <li key={p.id} className="flex justify-between border-b border-ink-100 pb-2">
                      <span>
                        {formatPHP(p.amount)} · {p.method}
                        {p.receipt_number ? " · " + p.receipt_number : ""}
                      </span>
                      <Link
                        href={"/accounting/payments/" + p.id + "/receipt"}
                        className="text-brand-600 hover:underline text-xs"
                      >
                        Receipt
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          {invoice.status !== "paid" && invoice.status !== "void" && (
            <PaymentForm invoiceId={invoice.id} remaining={Number(invoice.amount) - totalPaid} />
          )}
          {invoice.status !== "void" && (
            <VoidInvoiceButton id={invoice.id} />
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-ink-500">{label}</span>
      <span className="font-medium capitalize">{value}</span>
    </div>
  );
}
