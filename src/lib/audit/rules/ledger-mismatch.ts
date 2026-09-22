import type { Rule, RuleViolation } from "../types";

export const ledgerMismatch: Rule = {
  key: "LEDGER_MISMATCH",
  async run({ client }) {
    const { data: leases } = await client
      .schema("core").from("lease")
      .select("id, tenant_id");

    if (!leases || leases.length === 0) return [];

    const leaseIdsByTenant = new Map<string, string[]>();
    for (const l of leases) {
      const arr = leaseIdsByTenant.get(l.tenant_id) ?? [];
      arr.push(l.id);
      leaseIdsByTenant.set(l.tenant_id, arr);
    }

    const allLeaseIds = leases.map((l: any) => l.id);
    const { data: invoices } = await client
      .schema("acct").from("invoice")
      .select("id, lease_id, amount, status")
      .in("lease_id", allLeaseIds)
      .neq("status", "void");

    const { data: ledger } = await client
      .schema("acct").from("ledger_entry")
      .select("tenant_id, balance_after, created_at")
      .order("created_at", { ascending: false });

    const latestBalance = new Map<string, number>();
    for (const e of ledger ?? []) {
      if (!latestBalance.has(e.tenant_id)) {
        latestBalance.set(e.tenant_id, Number(e.balance_after));
      }
    }

    const violations: RuleViolation[] = [];
    for (const [tenantId, leaseIds] of leaseIdsByTenant.entries()) {
      const tenantInvoices = (invoices ?? []).filter((i: any) => leaseIds.includes(i.lease_id));
      const totalInvoiced = tenantInvoices.reduce((s: number, i: any) => s + Number(i.amount ?? 0), 0);

      const { data: payments } = await client
        .schema("acct").from("payment")
        .select("amount, invoice_id")
        .in("invoice_id", tenantInvoices.map((i: any) => i.id));
      const totalPaid = (payments ?? []).reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0);

      const expectedBalance = totalInvoiced - totalPaid;
      const actualBalance = latestBalance.get(tenantId) ?? 0;
      const diff = Math.abs(expectedBalance - actualBalance);

      if (diff > 1) {
        violations.push({
          entity_type: "tenant",
          entity_id: tenantId,
          title: "Ledger mismatch for tenant",
          summary: "Ledger balance differs from computed balance by " + diff.toFixed(2),
          evidence: {
            tenant_id: tenantId,
            total_invoiced: totalInvoiced,
            total_paid: totalPaid,
            expected_balance: expectedBalance,
            ledger_balance: actualBalance,
            difference: diff,
          },
        });
      }
    }
    return violations;
  },
};
