import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { RULES } from "./rules";
import type { RuleViolation, Severity } from "./types";

export type AuditRunResult = {
  rules_run: number;
  violations_found: number;
  new_findings: number;
  updated_findings: number;
  auto_closed: number;
  errors: { rule_key: string; message: string }[];
};

export async function runAudit(): Promise<AuditRunResult> {
  const admin = createAdminClient();

  // ── DIAGNOSTIC ──────────────────────────────────────────────────────
  console.log("[ENGINE] runAudit start, RULES.length =", RULES.length);
  console.log(
    "[ENGINE] RULES keys =",
    RULES.map((r) => r.key).join(", ")
  );
  // ────────────────────────────────────────────────────────────────────

  // Fetch ALL audit_rule rows, then filter enabled in JS.
  // The PostgREST `.eq("enabled", true)` filter was returning zero rows
  // even though the table has 12 enabled rows (verified in SQL editor).
  const { data: rules, error: rulesErr } = await admin
    .schema("acct").from("audit_rule")
    .select("key, severity, enabled, threshold");

  if (rulesErr) {
    console.error("[ENGINE] audit_rule query error:", rulesErr);
    throw new Error("audit_rule query failed: " + rulesErr.message);
  }

    const enabledRules = ((rules ?? []) as any[]).filter(
    (r) => r.enabled === true
  );

  const result: AuditRunResult = {
    rules_run: enabledRules.length,
    violations_found: 0,
    new_findings: 0,
    updated_findings: 0,
    auto_closed: 0,
    errors: [],
  };

  // ── DIAGNOSTIC ──────────────────────────────────────────────────────
  console.log(
    "[ENGINE] fetched audit_rule rows:",
    (rules ?? []).length,
    "| enabled after JS filter:",
    enabledRules.length
  );
  console.log(
    "[ENGINE] enabledRules from DB =",
    enabledRules.map((r) => r.key).join(", ")
  );
  // ────────────────────────────────────────────────────────────────────

  const stillViolating = new Set<string>();

  for (const rule of enabledRules) {
    const impl = RULES.find((r) => r.key === rule.key);

    // ── DIAGNOSTIC ────────────────────────────────────────────────────
    console.log(
      "[ENGINE] lookup",
      rule.key,
      "->",
      impl ? "found" : "NOT FOUND"
    );
    // ──────────────────────────────────────────────────────────────────

    if (!impl) continue;

    let violations: RuleViolation[] = [];
    try {
      violations = await impl.run({
        client: admin,
        threshold: rule.threshold ?? {},
      });

      // ── DIAGNOSTIC ──────────────────────────────────────────────────
      console.log(
        "[ENGINE] ran",
        rule.key,
        "->",
        violations.length,
        "violations"
      );
      // ────────────────────────────────────────────────────────────────
    } catch (err) {
      // ── DIAGNOSTIC ──────────────────────────────────────────────────
      console.error("[ENGINE] errored", rule.key, err);
      // ────────────────────────────────────────────────────────────────

      result.errors.push({
        rule_key: rule.key,
        message: err instanceof Error ? err.message : String(err),
      });
      continue;
    }

    result.violations_found += violations.length;

    for (const v of violations) {
      const tuple = rule.key + "|" + v.entity_type + "|" + v.entity_id;
      stillViolating.add(tuple);

      const { data: existing } = await admin
        .schema("acct").from("audit_finding")
        .select("id, status")
        .eq("rule_key", rule.key)
        .eq("entity_type", v.entity_type)
        .eq("entity_id", v.entity_id)
        .maybeSingle();

      if (existing) {
        const patch: Record<string, unknown> = {
          last_seen_at: new Date().toISOString(),
          evidence: v.evidence,
          severity: rule.severity as Severity,
          title: v.title,
          summary: v.summary,
        };
        if (existing.status === "resolved") {
          patch.status = "open";
          patch.resolved_at = null;
          patch.resolved_by = null;
          patch.resolution = null;
          patch.auto_closed = false;
        }
        await admin
          .schema("acct").from("audit_finding")
          .update(patch).eq("id", existing.id);
        result.updated_findings++;
      } else {
        const { error } = await admin
          .schema("acct").from("audit_finding")
          .insert({
            rule_key: rule.key,
            severity: rule.severity,
            status: "open",
            title: v.title,
            summary: v.summary,
            entity_type: v.entity_type,
            entity_id: v.entity_id,
            evidence: v.evidence,
          });
        if (!error) result.new_findings++;
        if (error) console.error("[ENGINE] insert error", rule.key, error); // ← DIAGNOSTIC
      }
    }
  }

  const { data: stale } = await admin
    .schema("acct").from("audit_finding")
    .select("id, rule_key, entity_type, entity_id")
    .in("status", ["open", "investigating"]);

  for (const f of stale ?? []) {
    const tuple = f.rule_key + "|" + f.entity_type + "|" + f.entity_id;
    if (!stillViolating.has(tuple)) {
      await admin
        .schema("acct").from("audit_finding")
        .update({
          status: "resolved",
          resolved_at: new Date().toISOString(),
          resolution: "Auto-closed: condition no longer detected",
          auto_closed: true,
        })
        .eq("id", f.id);
      result.auto_closed++;
    }
  }

  // ── DIAGNOSTIC ──────────────────────────────────────────────────────
  console.log("[ENGINE] runAudit done", JSON.stringify(result));
  // ────────────────────────────────────────────────────────────────────

  return result;
}