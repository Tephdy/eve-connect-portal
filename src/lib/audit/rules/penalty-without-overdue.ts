import type { Rule, RuleViolation } from "../types";

export const penaltyWithoutOverdue: Rule = {
  key: "PENALTY_WITHOUT_OVERDUE",
  async run({ client }) {
    const { data: penalties } = await client
      .schema("acct").from("invoice")
      .select("id, lease_id, amount, display_number, created_at")
      .eq("type", "penalty");

    if (!penalties || penalties.length === 0) return [];

    const leaseIds = Array.from(new Set(penalties.map((p: any) => p.lease_id)));
    const { data: overdueInvoices } = await client
      .schema("acct").from("invoice")
      .select("lease_id")
      .in("lease_id", leaseIds)
      .eq("status", "overdue");

    const leasesWithOverdue = new Set((overdueInvoices ?? []).map((i: any) => i.lease_id));

    const violations: RuleViolation[] = [];
    for (const p of penalties) {
      if (!leasesWithOverdue.has(p.lease_id)) {
        violations.push({
          entity_type: "invoice",
          entity_id: p.id,
          title: "Penalty without overdue rent",
          summary: "Penalty invoice on lease with no overdue invoices.",
          evidence: {
            penalty_invoice_id: p.id,
            display_number: p.display_number,
            lease_id: p.lease_id,
            amount: p.amount,
            created_at: p.created_at,
          },
        });
      }
    }
    return violations;
  },
};
