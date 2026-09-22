import type { Rule, RuleViolation } from "../types";

export const manualInvoiceWithoutLease: Rule = {
  key: "MANUAL_INVOICE_WITHOUT_LEASE",
  async run({ client }) {
    const { data: invoices } = await client
      .schema("acct").from("invoice")
      .select("id, type, amount, status, display_number, lease_id")
      .eq("type", "rent")
      .is("lease_id", null);

    if (!invoices) return [];

    return invoices.map((inv: any) => ({
      entity_type: "invoice",
      entity_id: inv.id,
      title: "Rent invoice without lease reference",
      summary: "Invoice type is rent but no lease is attached.",
      evidence: {
        invoice_id: inv.id,
        display_number: inv.display_number,
        amount: inv.amount,
        status: inv.status,
      },
    }));
  },
};
