import { requirePagePermission } from "@/lib/auth/guard";
import { buildReconciliation } from "@/lib/audit/reconciliation";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { SeverityBadge } from "@/components/audit/severity-badge";

export default async function ReconciliationPage() {
  await requirePagePermission("audit:read");
  const { rows, totals, generatedAt } = await buildReconciliation();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reconciliation"
        description={"Snapshot generated " + new Date(generatedAt).toLocaleString("en-PH")}
      />
      <div className="grid grid-cols-3 gap-4">
        <Card><CardBody>
          <p className="text-xs font-semibold uppercase text-ink-500">Open</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{totals.open}</p>
        </CardBody></Card>
        <Card><CardBody>
          <p className="text-xs font-semibold uppercase text-ink-500">Resolved</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-600">{totals.resolved}</p>
        </CardBody></Card>
        <Card><CardBody>
          <p className="text-xs font-semibold uppercase text-ink-500">Dismissed</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-ink-500">{totals.dismissed}</p>
        </CardBody></Card>
      </div>

      <Card>
        <CardHeader title="By rule" />
        <CardBody className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-white/40 text-left text-xs uppercase text-ink-500 dark:border-white/[0.06]">
              <tr>
                <th className="px-6 py-3">Rule</th>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3 text-right">Open</th>
                <th className="px-4 py-3 text-right">Resolved</th>
                <th className="px-4 py-3 text-right">Dismissed</th>
                <th className="px-6 py-3 text-right">Oldest open</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/40 dark:divide-white/[0.06]">
              {rows.map((r) => (
                <tr key={r.ruleKey}>
                  <td className="px-6 py-3 font-medium">{r.ruleName}</td>
                  <td className="px-4 py-3"><SeverityBadge severity={r.severity} /></td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.open}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-emerald-600">{r.resolved}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-ink-500">{r.dismissed}</td>
                  <td className="px-6 py-3 text-right tabular-nums text-ink-500">
                    {r.oldestOpenDays === null ? "\u2014" : r.oldestOpenDays + "d"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </div>
  );
}
