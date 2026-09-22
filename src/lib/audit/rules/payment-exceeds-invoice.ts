import type { Rule, RuleViolation } from "../types";

export const paymentExceedsInvoice: Rule = {
  key: "PAYMENT_EXCEEDS_INVOICE",
  async run({ client }) {
    const { data: invoices, error: invErr } = await client
      .schema("acct").from("invoice")
      .select("id, amount, display_number, status")
      .neq("status", "void");

    if (invErr) {
      throw new Error("PAYMENT_EXCEEDS_INVOICE.invoice: " + invErr.message);
    }
    if (!invoices || invoices.length === 0) return [];

    // Fetch ALL payments and filter locally.
    // Avoids the PostgREST `.in("invoice_id", [uuid,...])` quirk that can
    // silently return zero rows even when the data exists.
    const { data: payments, error: payErr } = await client
      .schema("acct").from("payment")
      .select("invoice_id, amount");

    if (payErr) {
      throw new Error("PAYMENT_EXCEEDS_INVOICE.payment: " + payErr.message);
    }

    const ids = new Set(invoices.map((i: any) => String(i.id)));

    // Temporary diagnostic — remove once the rule is verified working.
    console.log(
      "[PAYMENT_EXCEEDS_INVOICE] invoices:",
      invoices.length,
      "payments:", payments?.length ?? 0,
      "sampleInvoiceId:", invoices[0]?.id,
      "samplePaymentInvoiceId:", payments?.[0]?.invoice_id
    );

    const totals = new Map<string, number>();
    for (const p of payments ?? []) {
      const key = String(p.invoice_id);
      if (!ids.has(key)) continue;
      totals.set(key, (totals.get(key) ?? 0) + Number(p.amount ?? 0));
    }

    const violations: RuleViolation[] = [];
    for (const inv of invoices) {
      const totalPaid = totals.get(String(inv.id)) ?? 0;
      const invoiceAmt = Number(inv.amount ?? 0);
      if (totalPaid > invoiceAmt + 0.01) {
        violations.push({
          entity_type: "invoice",
          entity_id: inv.id,
          title:
            "Invoice " +
            (inv.display_number ?? String(inv.id).slice(0, 8)) +
            " overpaid by " +
            (totalPaid - invoiceAmt).toFixed(2),
          summary: "Payments sum to more than the invoice amount.",
          evidence: {
            invoice_id: inv.id,
            display_number: inv.display_number,
            invoice_amount: invoiceAmt,
            total_paid: totalPaid,
            difference: totalPaid - invoiceAmt,
          },
        });
      }
    }
    return violations;
  },
};