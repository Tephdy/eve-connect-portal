import { Settings2 } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/guard";
import { listTaskTypes } from "@/lib/db/job-task-types";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { StatusPill } from "@/components/dashboard/status-pill";
import { formatPHP } from "@/lib/utils/format-php";

export default async function TaskTypesPage() {
  await requirePagePermission("joborder:update");
  const types = await listTaskTypes();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Task Types"
        description="Approval thresholds per maintenance category."
      />

      <Card className="overflow-hidden">
        <CardBody className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Task type</TH>
                <TH>Key</TH>
                <TH className="text-right">Approval threshold</TH>
                <TH>Rule</TH>
              </TR>
            </THead>
            <TBody>
              {types.map((t) => (
                <TR key={t.id}>
                  <TD>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400">
                        <Settings2 className="h-4 w-4" />
                      </div>
                      <span className="font-medium text-ink-900">{t.name}</span>
                    </div>
                  </TD>
                  <TD>
                    <code className="rounded bg-ink-100 px-1.5 py-0.5 font-mono text-xs text-ink-600 dark:bg-white/[0.06] dark:text-ink-500">
                      {t.key}
                    </code>
                  </TD>
                  <TD className="text-right font-medium text-ink-900">
                    {formatPHP(t.approval_threshold_php)}
                  </TD>
                  <TD>
                    <StatusPill tone="brand">
                      requires approval above threshold
                    </StatusPill>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );
}
