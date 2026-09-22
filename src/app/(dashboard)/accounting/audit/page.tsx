import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/guard";
import { getAuditStats, listFindings } from "@/lib/db/audit";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HealthGauge } from "@/components/audit/health-gauge";
import { SeverityBadge } from "@/components/audit/severity-badge";
import { StatusBadge } from "@/components/audit/status-badge";
import { RunAuditButton } from "@/components/audit/run-audit-button";

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</p>
      <p className={"mt-1 text-2xl font-bold tabular-nums " + tone}>{value}</p>
    </div>
  );
}

export default async function AuditDashboard() {
  await requirePagePermission("audit:read");

  const [stats, recent] = await Promise.all([
    getAuditStats(),
    listFindings({ status: "open" }),
  ]);

  const topRecent = recent.slice(0, 8);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit"
        description="Continuous controls monitoring over invoices, payments, and leases."
        action={<RunAuditButton />}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardBody className="flex flex-col items-center justify-center py-8">
            <HealthGauge score={stats.health_score} />
            <p className="mt-4 text-center text-sm text-ink-500">
              Composite score across {stats.total_open} open finding(s)
            </p>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Findings by severity" />
          <CardBody>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="Critical" value={stats.by_severity.critical} tone="text-rose-600 dark:text-rose-400" />
              <Stat label="High" value={stats.by_severity.high} tone="text-amber-600 dark:text-amber-400" />
              <Stat label="Medium" value={stats.by_severity.medium} tone="text-sky-600 dark:text-sky-400" />
              <Stat label="Low" value={stats.by_severity.low} tone="text-ink-500" />
            </div>
            <div className="mt-5 grid grid-cols-3 gap-4 border-t border-white/40 pt-4 dark:border-white/[0.06]">
              <Stat label="Total open" value={stats.total_open} tone="text-ink-900" />
              <Stat label="Resolved" value={stats.by_status.resolved} tone="text-emerald-600 dark:text-emerald-400" />
              <Stat label="Dismissed" value={stats.by_status.dismissed} tone="text-ink-500" />
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Recent open findings"
          action={
            <Link href="/accounting/audit/findings">
              <Button variant="secondary" size="sm">
                View all
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </Link>
          }
        />
        <CardBody className="p-0">
          {topRecent.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-ink-500">
              No open findings. Portfolio is clean.
            </div>
          ) : (
            <ul className="divide-y divide-white/40 dark:divide-white/[0.06]">
              {topRecent.map((f) => (
                <li key={f.id}>
                  <Link
                    href={"/accounting/audit/findings/" + f.id}
                    className="flex items-center justify-between gap-4 px-6 py-3 transition-colors hover:bg-white/40 dark:hover:bg-white/[0.03]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <SeverityBadge severity={f.severity} />
                        <p className="truncate font-medium text-ink-900">{f.title}</p>
                      </div>
                      {f.summary && (
                        <p className="mt-0.5 truncate text-xs text-ink-500">{f.summary}</p>
                      )}
                    </div>
                    <StatusBadge status={f.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
