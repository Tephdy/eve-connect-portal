import type { Rule, RuleViolation } from "../types";

export const invoicePaidNoPayment: Rule = {
  key: "INVOICE_PAID_NO_PAYMENT",
  async run({ client }) {
    const { data: invoices } = await client
      .schema("acct").from("invoice")
      .select("id, lease_id, amount, status, display_number, due_date")
      .eq("status", "paid");

    if (!invoices || invoices.length === 0) return [];

    const ids = invoices.map((i: any) => i.id);
    const { data: payments } = await client
      .schema("acct").from("payment")
      .select("invoice_id")
      .in("invoice_id", ids);

    const paidSet = new Set((payments ?? []).map((p: any) => p.invoice_id));

    const violations: RuleViolation[] = [];
    for (const inv of invoices) {
      if (!paidSet.has(inv.id)) {
        violations.push({
          entity_type: "invoice",
          entity_id: inv.id,
          title: "Invoice " + (inv.display_number ?? inv.id.slice(0, 8)) + " marked paid but no payment exists",
          summary: "This invoice has status paid but no matching row in acct.payment.",
          evidence: {
            invoice_id: inv.id,
            display_number: inv.display_number,
            amount: inv.amount,
            status: inv.status,
            due_date: inv.due_date,
          },
        });
      }
    }
    return violations;
  },
};
