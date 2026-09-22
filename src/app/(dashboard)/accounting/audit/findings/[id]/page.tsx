import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/guard";
import { getFinding, listComments } from "@/lib/db/audit";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { SeverityBadge } from "@/components/audit/severity-badge";
import { StatusBadge } from "@/components/audit/status-badge";
import { FindingEvidence } from "@/components/audit/finding-evidence";
import { FindingActions } from "@/components/audit/finding-actions";
import { FindingComments } from "@/components/audit/finding-comments";

export default async function FindingDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requirePagePermission("audit:read");

  const finding = await getFinding(params.id);
  if (!finding) notFound();

  const comments =
    typeof listComments === "function"
      ? await listComments(finding.id)
      : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={finding.title}
        description={finding.rule_name ?? finding.rule_key}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Details" />
            <CardBody className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <SeverityBadge severity={finding.severity} />
                <StatusBadge status={finding.status} />
                <span className="text-xs text-ink-500">
                  Detected {new Date(finding.detected_at).toLocaleString("en-PH")}
                </span>
              </div>
              {finding.summary && (
                <p className="text-sm leading-relaxed text-ink-700 dark:text-ink-300">
                  {finding.summary}
                </p>
              )}
              {finding.resolution && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                    Resolution
                  </p>
                  <p className="mt-1 text-sm text-ink-700 dark:text-ink-300">{finding.resolution}</p>
                </div>
              )}
            </CardBody>
          </Card>

          <FindingEvidence evidence={finding.evidence} />
          <FindingComments findingId={finding.id} comments={comments} />
        </div>

        <div className="space-y-6">
          <FindingActions id={finding.id} status={finding.status} />
        </div>
      </div>
    </div>
  );
}
