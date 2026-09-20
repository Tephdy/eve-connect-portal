"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertPermission } from "@/lib/auth/guard";
import { getSession } from "@/lib/auth/get-session";
import { createInvoice, markInvoicePaid, voidInvoice, getInvoice } from "@/lib/db/invoices";
import { recordPayment } from "@/lib/db/payments";
import { getLease } from "@/lib/db/leases";
import { getTenant } from "@/lib/db/tenants";
import { getUnit } from "@/lib/db/units";
import { getProperty } from "@/lib/db/properties";
import { logAudit } from "@/lib/audit/log";
import { emit } from "@/lib/events/emit";
import { sendEmail } from "@/lib/email/send";
import { receiptEmailHtml } from "@/lib/email/templates";
import { formatPHP } from "@/lib/utils/format-php";
import { invoiceCreateSchema, paymentCreateSchema } from "@/lib/schemas/invoice";
import { parseForm } from "@/lib/forms/parse";
import type { ActionResult } from "@/lib/actions/result";

export async function createInvoiceAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await assertPermission("invoice:create");
  const parsed = parseForm(invoiceCreateSchema, formData);
  if (!parsed.ok) return { ok: false, error: parsed.error, fieldErrors: parsed.fieldErrors };

  const session = await getSession();
  const invoice = await createInvoice(parsed.data);

  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "invoice",
    entity_id: invoice.id,
    action: "create",
    after: invoice,
  });

  await emit("invoice.created", { invoice_id: invoice.id }, session?.id ?? null);

  revalidatePath("/accounting/invoices");
  redirect("/accounting/invoices/" + invoice.id);
}

export async function recordPaymentAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await assertPermission("payment:create");
  const parsed = parseForm(paymentCreateSchema, formData);
  if (!parsed.ok) return { ok: false, error: parsed.error, fieldErrors: parsed.fieldErrors };

  const session = await getSession();
  const payment = await recordPayment({ ...parsed.data, recorded_by: session?.id ?? null });

  // Mark invoice paid (V1: single payment per invoice)
  await markInvoicePaid(payment.invoice_id);

  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "payment",
    entity_id: payment.id,
    action: "create",
    after: payment,
  });

  await emit("invoice.paid", {
    payment_id: payment.id,
    invoice_id: payment.invoice_id,
    amount: payment.amount,
  }, session?.id ?? null);

  // Send receipt email (best-effort — never blocks the payment)
  await sendReceiptEmail(payment);

  revalidatePath("/accounting/invoices/" + payment.invoice_id);
  revalidatePath("/accounting/payments");
  return { ok: true, data: undefined };
}

export async function voidInvoiceAction(id: string): Promise<void> {
  await assertPermission("invoice:void");
  const session = await getSession();
  await voidInvoice(id);
  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "invoice",
    entity_id: id,
    action: "archive",
    reason: "voided",
  });
  revalidatePath("/accounting/invoices");
  revalidatePath("/accounting/invoices/" + id);
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

async function sendReceiptEmail(payment: {
  id: string;
  invoice_id: string;
  amount: number;
  method: string;
  paid_at: string;
  receipt_number: string | null;
}) {
  try {
    const invoice = await getInvoice(payment.invoice_id);
    if (!invoice) return;

    const lease = await getLease(invoice.lease_id);
    if (!lease) return;

    const [tenant, unit] = await Promise.all([
      getTenant(lease.tenant_id),
      getUnit(lease.unit_id),
    ]);
    if (!tenant?.email || !unit) return;

    const property = await getProperty(unit.property_id);
    if (!property) return;

    await sendEmail({
      to: tenant.email,
      subject: "Payment receipt " + (payment.receipt_number ?? ""),
      html: receiptEmailHtml({
        tenant_name: tenant.full_name,
        receipt_number: payment.receipt_number ?? "—",
        invoice_number: invoice.display_number,
        amount: formatPHP(payment.amount),
        method: payment.method,
        paid_at: new Date(payment.paid_at).toLocaleString("en-PH"),
        property_name: property.name,
        unit_number: unit.unit_number,
      }),
    });
  } catch (err) {
    // Receipt email is best-effort — a failure here must not break payment recording
    console.error("[sendReceiptEmail] failed:", err);
  }
}