import type { Rule, RuleViolation } from "../types";

export const depositHeldTooLong: Rule = {
  key: "DEPOSIT_HELD_TOO_LONG",
  async run({ client, threshold }) {
    const days = Number(threshold.days ?? 90);

    const { data: deposits } = await client
      .schema("acct").from("deposit")
      .select("id, lease_id, amount, status, refunded_amount")
      .in("status", ["held", "partial"]);

    if (!deposits || deposits.length === 0) return [];

    const leaseIds = Array.from(new Set(deposits.map((d: any) => d.lease_id)));
    const { data: leases } = await client
      .schema("core").from("lease")
      .select("id, end_date, status")
      .in("id", leaseIds);

    const leaseMap = new Map<string, any>(
      (leases ?? []).map((l: any) => [l.id, l])
    );

    const violations: RuleViolation[] = [];
    const now = Date.now();
    for (const d of deposits) {
      const lease = leaseMap.get(d.lease_id);
      if (!lease) continue;
      const daysSinceEnd = Math.floor(
        (now - new Date(lease.end_date).getTime()) / 86400000
      );
      if (daysSinceEnd >= days) {
        violations.push({
          entity_type: "deposit",
          entity_id: d.id,
          title: "Deposit held " + daysSinceEnd + " days after lease ended",
          summary: "Deposit should be settled by now.",
          evidence: {
            deposit_id: d.id,
            amount: d.amount,
            status: d.status,
            lease_end_date: lease.end_date,
            days_since_end: daysSinceEnd,
          },
        });
      }
    }
    return violations;
  },
};