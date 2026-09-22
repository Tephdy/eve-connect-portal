import { requirePagePermission } from "@/lib/auth/guard";
import { listRules, listFindings } from "@/lib/db/audit";
import { PageHeader } from "@/components/layout/page-header";
import { RuleTable } from "@/components/audit/rule-table";

export default async function RulesPage() {
  await requirePagePermission("audit:read");

  const [rules, findings] = await Promise.all([
    listRules(),
    listFindings({ status: "open" }),
  ]);

  const counts: Record<string, number> = {};
  for (const f of findings) {
    const key = f.rule_key;
    counts[key] = (counts[key] ?? 0) + 1;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit rules"
        description="Configure which controls are checked during each audit run."
      />
      <RuleTable rules={rules} findingsByRule={counts} />
    </div>
  );
}
