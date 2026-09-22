import type { Rule, RuleViolation } from "../types";

export const sameUserCreatedAndApproved: Rule = {
  key: "SAME_USER_CREATED_AND_APPROVED",
  async run({ client, threshold }) {
    const windowMinutes = Number(threshold.window_minutes ?? 1);

    const { data: payments } = await client
      .schema("acct").from("payment")
      .select("id, invoice_id, recorded_by, paid_at");

    if (!payments || payments.length === 0) return [];

    const invoiceIds = Array.from(new Set(payments.map((p: any) => p.invoice_id)));
    const { data: logs } = await client
      .schema("core").from("audit_log")
      .select("entity_id, actor_user_id, created_at, action")
      .eq("entity_type", "invoice")
      .eq("action", "create")
      .in("entity_id", invoiceIds);

    const invoiceCreator = new Map<string, { user: string; at: string }>();
    for (const l of logs ?? []) {
      invoiceCreator.set(l.entity_id, { user: l.actor_user_id, at: l.created_at });
    }

    const violations: RuleViolation[] = [];
    for (const p of payments) {
      const creator = invoiceCreator.get(p.invoice_id);
      if (!creator) continue;
      if (creator.user !== p.recorded_by) continue;

      const diffMin = Math.abs(
        (new Date(p.paid_at).getTime() - new Date(creator.at).getTime()) / 60000
      );

      if (diffMin <= windowMinutes) {
        violations.push({
          entity_type: "payment",
          entity_id: p.id,
          title: "Same user created invoice and recorded payment",
          summary: "Segregation of duties violation - same user in " + Math.round(diffMin) + " min.",
          evidence: {
            payment_id: p.id,
            invoice_id: p.invoice_id,
            user_id: p.recorded_by,
            invoice_created_at: creator.at,
            payment_paid_at: p.paid_at,
            minutes_apart: Math.round(diffMin),
          },
        });
      }
    }
    return violations;
  },
};
