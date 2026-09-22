import type { Rule, RuleViolation } from "../types";

export const orphanInvoice: Rule = {
  key: "ORPHAN_INVOICE",
  async run({ client }) {
    const { data: invoices } = await client
      .schema("acct").from("invoice")
      .select("id, lease_id, amount, status, display_number")
      .not("lease_id", "is", null);

    if (!invoices || invoices.length === 0) return [];

    const leaseIds = Array.from(new Set(invoices.map((i: any) => i.lease_id)));
    const { data: leases } = await client
      .schema("core").from("lease")
      .select("id")
      .in("id", leaseIds);

    const existingLeases = new Set((leases ?? []).map((l: any) => l.id));

    const violations: RuleViolation[] = [];
    for (const inv of invoices) {
      if (!existingLeases.has(inv.lease_id)) {
        violations.push({
          entity_type: "invoice",
          entity_id: inv.id,
          title: "Invoice references missing lease",
          summary: "Lease " + inv.lease_id.slice(0, 8) + " no longer exists.",
          evidence: {
            invoice_id: inv.id,
            display_number: inv.display_number,
            lease_id: inv.lease_id,
            amount: inv.amount,
            status: inv.status,
          },
        });
      }
    }
    return violations;
  },
};
