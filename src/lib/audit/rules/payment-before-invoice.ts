import type { Rule, RuleViolation } from "../types";

export const paymentBeforeInvoice: Rule = {
  key: "PAYMENT_BEFORE_INVOICE",
  async run({ client }) {
    const { data: payments } = await client
      .schema("acct").from("payment")
      .select("id, invoice_id, amount, paid_at");

    if (!payments || payments.length === 0) return [];

    const invoiceIds = Array.from(new Set(payments.map((p: any) => p.invoice_id)));
    const { data: invoices } = await client
      .schema("acct").from("invoice")
      .select("id, created_at, display_number")
      .in("id", invoiceIds);

    const invMap = new Map<string, any>((invoices ?? []).map((i: any) => [i.id, i]));

    const violations: RuleViolation[] = [];
    for (const p of payments) {
      const inv = invMap.get(p.invoice_id);
      if (!inv) continue;
      const paid = new Date(p.paid_at).getTime();
      const created = new Date(inv.created_at).getTime();
      if (paid < created - 60000) {
        violations.push({
          entity_type: "payment",
          entity_id: p.id,
          title: "Payment recorded before invoice existed",
          summary: "Payment date is earlier than the invoice creation date.",
          evidence: {
            payment_id: p.id,
            payment_paid_at: p.paid_at,
            invoice_id: inv.id,
            invoice_created_at: inv.created_at,
            minutes_early: Math.round((created - paid) / 60000),
          },
        });
      }
    }
    return violations;
  },
};
