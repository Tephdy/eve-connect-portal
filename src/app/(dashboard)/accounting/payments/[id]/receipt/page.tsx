import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/guard";
import { getPayment } from "@/lib/db/payments";
import { getInvoice } from "@/lib/db/invoices";
import { getLease, listLeases } from "@/lib/db/leases";
import { getTenant } from "@/lib/db/tenants";
import { getUnit } from "@/lib/db/units";
import { getProperty } from "@/lib/db/properties";
import { createClient } from "@/lib/supabase/server";
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

  // Preferred path: the invoice carries a lease_id.
  let lease = invoice && invoice.lease_id ? await getLease(invoice.lease_id) : null;

  // Fallback: no lease on the invoice (e.g. reservation-fee).
  // Resolve the tenant from the invoice or payment, then find
  // the tenant's current lease for property/unit.
  // Prefer the invoice's own tenant_id (works even if the lease was deleted),
    // then the payment's, then the lease's.
    const tenantId =
      invoice?.tenant_id ??
      payment.tenant_id ??
      (lease?.tenant_id ?? null);

  if (!lease && tenantId) {
    const tenantLeases = await listLeases({});
    const mine = (tenantLeases as any[]).filter((l) => l.tenant_id === tenantId);
    lease =
      mine.find((l) => l.status === "active" || l.status === "expiring") ??
      mine[0] ??
      null;
  }

  const tenant = tenantId ? await getTenant(tenantId) : null;
  let unit = lease ? await getUnit(lease.unit_id) : null;
  let property = unit ? await getProperty(unit.property_id) : null;

  // Fallback: reservation-fee receipts have no tenant yet. Read the
  // client + unit directly from the reservation.
  let reservationClientName: string | null = null;
  if (!tenant && invoice?.reservation_id) {
    const sb = await createClient();
    const { data: res } = await sb
      .schema("acct")
      .from("unit_reservation")
      .select("client_name, unit_id")
      .eq("id", invoice.reservation_id)
      .maybeSingle();
    if (res) {
      reservationClientName = (res as any).client_name ?? null;
      const rUnitId = (res as any).unit_id ?? null;
      if (!unit && rUnitId) {
        unit = await getUnit(rUnitId);
        if (unit) {
          property = await getProperty(unit.property_id);
        }
      }
    }
  }

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
            <Row
              label="Payment for"
              value={
                ({
                  rent: "Rent",
                  utility: "Utility",
                  deposit: "Deposit",
                  penalty: "Penalty",
                  "add-ons": "Add-ons",
                  reservation_fee: "Reservation fee",
                  other: "Other",
                } as Record<string, string>)[invoice?.type ?? ""] ??
                (invoice?.type ?? "—")
              }
            />
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
