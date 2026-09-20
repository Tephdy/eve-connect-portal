import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/guard";
import { getPayment } from "@/lib/db/payments";
import { getInvoice } from "@/lib/db/invoices";
import { getLease } from "@/lib/db/leases";
import { getTenant } from "@/lib/db/tenants";
import { getUnit } from "@/lib/db/units";
import { getProperty } from "@/lib/db/properties";
import { formatPHP } from "@/lib/utils/format-php";
import { PrintButton } from "@/components/accounting/print-button";
import { Card, CardBody } from "@/components/ui/card";

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("payment:read");
  const { id } = await params;
  const payment = await getPayment(id);
  if (!payment) notFound();

  const invoice = await getInvoice(payment.invoice_id);
  const lease = invoice ? await getLease(invoice.lease_id) : null;
  const tenant = lease ? await getTenant(lease.tenant_id) : null;
  const unit = lease ? await getUnit(lease.unit_id) : null;
  const property = unit ? await getProperty(unit.property_id) : null;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex justify-end no-print">
        <PrintButton />
      </div>

      <Card>
        <CardBody className="p-10">
          {/* Header */}
          <div className="border-b border-ink-200 pb-6 text-center dark:border-white/[0.06]">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-gradient shadow-glow-sm">
              <span className="text-lg font-bold text-white">A</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink-900">
              Payment Receipt
            </h1>
            <p className="mt-1 font-mono text-sm text-ink-500">
              {payment.receipt_number ?? "—"}
            </p>
          </div>

          {/* Details */}
          <div className="mt-6 space-y-3.5 text-sm">
            <Row label="Received from" value={tenant?.full_name ?? "—"} />
            <Row label="Property" value={property?.name ?? "—"} />
            <Row label="Unit" value={unit?.unit_number ?? "—"} />
            <Row label="Invoice" value={invoice?.display_number ?? "—"} />
            <Row label="Method" value={payment.method.replace("_", " ")} />
            {payment.reference_no && (
              <Row label="Reference" value={payment.reference_no} />
            )}
            <Row
              label="Paid at"
              value={new Date(payment.paid_at).toLocaleString("en-PH", {
                month: "long",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            />
          </div>

          {/* Amount */}
          <div className="mt-8 rounded-xl border border-success-500/20 bg-success-50 p-5 dark:border-success-500/20 dark:bg-success-500/10">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium uppercase tracking-wider text-success-700 dark:text-success-500">
                Amount paid
              </span>
              <span className="text-2xl font-bold text-success-700 dark:text-success-500">
                {formatPHP(payment.amount)}
              </span>
            </div>
          </div>

          {/* Footer */}
          <p className="mt-10 text-center text-xs text-ink-400">
            This is an automated receipt. Please keep it for your records.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-ink-500">{label}</span>
      <span className="text-right font-medium capitalize text-ink-900">{value}</span>
    </div>
  );
}
