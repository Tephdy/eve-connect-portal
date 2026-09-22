import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Card, CardBody } from "@/components/ui/card";
import { SeverityBadge } from "./severity-badge";
import { RuleToggle } from "./rule-toggle";
import type { AuditRule } from "@/lib/audit/types";

export function RuleTable({
  rules,
  findingsByRule,
}: {
  rules: AuditRule[];
  findingsByRule: Record<string, number>;
}) {
  return (
    <Card className="overflow-hidden">
      <CardBody className="p-0">
        <Table>
          <THead>
            <TR>
              <TH className="w-24">Severity</TH>
              <TH>Rule</TH>
              <TH>Key</TH>
              <TH className="text-right">Open findings</TH>
              <TH className="w-24 text-right">Enabled</TH>
            </TR>
          </THead>
          <TBody>
            {rules.map((r) => (
              <TR key={r.id}>
                <TD><SeverityBadge severity={r.severity} /></TD>
                <TD>
                  <p className="font-medium text-ink-900">{r.name}</p>
                  {r.description && (
                    <p className="mt-0.5 text-xs text-ink-500">{r.description}</p>
                  )}
                </TD>
                <TD>
                  <code className="rounded bg-ink-100/70 px-1.5 py-0.5 font-mono text-[11px] text-ink-600 dark:bg-white/[0.06] dark:text-ink-400">
                    {r.key}
                  </code>
                </TD>
                <TD className="text-right font-semibold tabular-nums">
                  {findingsByRule[r.key] ?? 0}
                </TD>
                <TD className="text-right">
                  <RuleToggle ruleKey={r.key} enabled={r.enabled} />
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </CardBody>
    </Card>
  );
}
