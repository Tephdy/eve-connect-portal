import { requirePagePermission } from "@/lib/auth/guard";
import { listFindings } from "@/lib/db/audit";
import { PageHeader } from "@/components/layout/page-header";
import { FindingTable } from "@/components/audit/finding-table";
import { FindingFilters } from "@/components/audit/finding-filters";
import type { FindingStatus, Severity } from "@/lib/audit/types";

export default async function FindingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; severity?: string }>;
}) {
  const _sp = await searchParams;
  await requirePagePermission("audit:read");

  const status = _sp.status as FindingStatus | undefined;
  const severity = _sp.severity as Severity | undefined;

  const findings = await listFindings({ status, severity });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Findings"
        description="All audit findings across the portfolio."
      />
      <FindingFilters />
      <FindingTable findings={findings} />
    </div>
  );
}
