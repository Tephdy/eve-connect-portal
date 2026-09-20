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
    <div className="max-w-2xl mx-auto">
      <div className="mb-4 flex justify-end">
        <PrintButton />
      </div>
      <div className="bg-white border border-gray-200 rounded-lg p-10">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-brand-600">Payment Receipt</h1>
          <p className="text-sm text-gray-500 mt-1">{payment.receipt_number}</p>
        </div>

        <div className="text-sm space-y-3">
          <Row label="Received from" value={tenant?.full_name ?? "—"} />
          <Row label="Property" value={property?.name ?? "—"} />
          <Row label="Unit" value={unit?.unit_number ?? "—"} />
          <Row label="Invoice" value={invoice?.display_number ?? "—"} />
          <Row label="Method" value={payment.method} />
          {payment.reference_no && <Row label="Reference" value={payment.reference_no} />}
          <Row label="Paid at" value={new Date(payment.paid_at).toLocaleString("en-PH")} />
        </div>

        <div className="border-t-2 border-brand-500 mt-8 pt-4">
          <div className="flex justify-between items-center text-lg">
            <span className="font-medium">Amount paid</span>
            <span className="font-bold text-green-700">{formatPHP(payment.amount)}</span>
          </div>
        </div>

        <p className="text-xs text-gray-500 text-center mt-10">
          This is an automated receipt. Please keep it for your records.
        </p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
