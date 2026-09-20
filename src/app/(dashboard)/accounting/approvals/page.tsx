import { requirePagePermission } from "@/lib/auth/guard";
import { listPendingApprovals } from "@/lib/db/job-orders";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { ApprovalTable } from "@/components/accounting/approval-table";

export default async function ApprovalsPage() {
  await requirePagePermission("invoice:create");
  const jobs = await listPendingApprovals();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cost Approvals"
        description="Job orders above their task-type threshold awaiting your decision."
      />
      {jobs.length === 0 ? (
        <EmptyState
          title="Nothing to approve"
          description="All pending job orders are within budget."
        />
      ) : (
        <ApprovalTable jobs={jobs} />
      )}
    </div>
  );
}
