import type { Rule, RuleViolation } from "../types";

export const duplicatePayment: Rule = {
  key: "DUPLICATE_PAYMENT",
  async run({ client, threshold }) {
    const windowMinutes = Number(threshold.window_minutes ?? 60);

    const { data: payments } = await client
      .schema("acct").from("payment")
      .select("id, invoice_id, amount, paid_at, receipt_number, method");

    if (!payments || payments.length < 2) return [];

    const groups = new Map<string, any[]>();
    for (const p of payments) {
      const key = p.invoice_id + "|" + Number(p.amount).toFixed(2);
      const arr = groups.get(key) ?? [];
      arr.push(p);
      groups.set(key, arr);
    }

    const violations: RuleViolation[] = [];
    for (const [, arr] of groups.entries()) {
      if (arr.length < 2) continue;
      arr.sort((a, b) => new Date(a.paid_at).getTime() - new Date(b.paid_at).getTime());

      for (let i = 0; i < arr.length - 1; i++) {
        const a = arr[i];
        const b = arr[i + 1];
        const diffMin = (new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime()) / 60000;
        if (diffMin <= windowMinutes) {
          violations.push({
            entity_type: "payment",
            entity_id: b.id,
            title: "Duplicate payment suspected on invoice " + a.invoice_id.slice(0, 8),
            summary: "Two payments of " + Number(a.amount).toFixed(2) + " within " + Math.round(diffMin) + " minutes.",
            evidence: {
              payment_a: { id: a.id, paid_at: a.paid_at, receipt_number: a.receipt_number, method: a.method },
              payment_b: { id: b.id, paid_at: b.paid_at, receipt_number: b.receipt_number, method: b.method },
              amount: a.amount,
              minutes_apart: Math.round(diffMin),
            },
          });
        }
      }
    }
    return violations;
  },
};
