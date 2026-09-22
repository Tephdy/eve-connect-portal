import { listFindings } from "@/lib/db/audit";
import type { AuditFinding } from "@/lib/audit/types";

export type ReconRow = {
  ruleKey: string;
  ruleName: string;
  severity: AuditFinding["severity"];
  open: number;
  resolved: number;
  dismissed: number;
  oldestOpenDays: number | null;
};

export type ReconResult = {
  rows: ReconRow[];
  totals: { open: number; resolved: number; dismissed: number };
  generatedAt: string;
};

export async function buildReconciliation(): Promise<ReconResult> {
  const findings = await listFindings({});

  const byRule = new Map<string, ReconRow>();
  for (const f of findings) {
    const key = f.rule_key;
    let row = byRule.get(key);
    if (!row) {
      row = {
        ruleKey: key,
        ruleName: f.rule_name ?? key,
        severity: f.severity,
        open: 0,
        resolved: 0,
        dismissed: 0,
        oldestOpenDays: null,
      };
      byRule.set(key, row);
    }
    if (f.status === "open" || f.status === "investigating") {
      row.open++;
      const age = Math.floor((Date.now() - new Date(f.detected_at).getTime()) / 86400000);
      if (row.oldestOpenDays === null || age > row.oldestOpenDays) {
        row.oldestOpenDays = age;
      }
    } else if (f.status === "resolved") row.resolved++;
    else if (f.status === "dismissed") row.dismissed++;
  }

  const rows = [...byRule.values()].sort((a, b) => b.open - a.open);
  const totals = rows.reduce(
    (t, r) => ({
      open: t.open + r.open,
      resolved: t.resolved + r.resolved,
      dismissed: t.dismissed + r.dismissed,
    }),
    { open: 0, resolved: 0, dismissed: 0 }
  );

  return { rows, totals, generatedAt: new Date().toISOString() };
}
