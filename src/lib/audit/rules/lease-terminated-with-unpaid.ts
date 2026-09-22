import type { Rule, RuleViolation } from "../types";

export const leaseTerminatedWithUnpaid: Rule = {
  key: "LEASE_TERMINATED_WITH_UNPAID",
  async run({ client }) {
    const { data: leases } = await client
      .schema("core").from("lease")
      .select("id, unit_id, tenant_id, end_date, status")
      .eq("status", "terminated");

    if (!leases || leases.length === 0) return [];

    const leaseIds = leases.map((l: any) => l.id);
    const { data: invoices } = await client
      .schema("acct").from("invoice")
      .select("id, lease_id, amount, status, display_number")
      .in("lease_id", leaseIds)
      .in("status", ["unpaid", "overdue"]);

    const byLease = new Map<string, any[]>();
    for (const inv of invoices ?? []) {
      const arr = byLease.get(inv.lease_id) ?? [];
      arr.push(inv);
      byLease.set(inv.lease_id, arr);
    }

    const violations: RuleViolation[] = [];
    for (const lease of leases) {
      const invs = byLease.get(lease.id);
      if (!invs || invs.length === 0) continue;
      const totalUnpaid = invs.reduce((s, i: any) => s + Number(i.amount ?? 0), 0);
      violations.push({
        entity_type: "lease",
        entity_id: lease.id,
        title: "Terminated lease has " + invs.length + " unpaid invoices",
        summary: totalUnpaid.toFixed(2) + " still outstanding on a terminated lease.",
        evidence: {
          lease_id: lease.id,
          invoice_count: invs.length,
          total_unpaid: totalUnpaid,
          invoices: invs.map((i: any) => ({
            id: i.id,
            display_number: i.display_number,
            amount: i.amount,
            status: i.status,
          })),
        },
      });
    }
    return violations;
  },
};
