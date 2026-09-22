import type { Rule, RuleViolation } from "../types";

export const overdueInvoiceUnflagged: Rule = {
  key: "OVERDUE_INVOICE_UNFLAGGED",
  async run({ client, threshold }) {
    const days = Number(threshold.days ?? 7);
    const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

    const { data: invoices } = await client
      .schema("acct").from("invoice")
      .select("id, amount, due_date, status, display_number")
      .eq("status", "unpaid")
      .lt("due_date", cutoff);

    if (!invoices) return [];

    return invoices.map((inv: any) => {
      const daysOverdue = Math.ceil((Date.now() - new Date(inv.due_date).getTime()) / 86400000);
      return {
        entity_type: "invoice",
        entity_id: inv.id,
        title: "Invoice " + (inv.display_number ?? inv.id.slice(0, 8)) + " overdue by " + daysOverdue + " days",
        summary: "Due date passed but status is still unpaid.",
        evidence: {
          invoice_id: inv.id,
          display_number: inv.display_number,
          due_date: inv.due_date,
          amount: inv.amount,
          days_overdue: daysOverdue,
        },
      };
    });
  },
};
