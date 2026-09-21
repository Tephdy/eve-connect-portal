import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/guard";
import { getJobOrder } from "@/lib/db/job-orders";
import { listWorkLogs } from "@/lib/db/work-logs";
import { listUnits } from "@/lib/db/units";
import { listTaskTypes } from "@/lib/db/job-task-types";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { JobOrderForm } from "@/components/maintenance/job-order-form";
import { WorkLogPanel } from "@/components/maintenance/work-log-panel";
import { JobOrderActions } from "@/components/maintenance/job-order-actions";
import { CancelJobOrderButton } from "@/components/maintenance/cancel-job-order-button";
import { DeleteJobOrderButton } from "@/components/maintenance/delete-job-order-button";
import { hasPermission } from "@/lib/auth/require-permission";
import { formatPHP } from "@/lib/utils/format-php";

const STATUS_TONE: Record<string, "gray" | "yellow" | "blue" | "green" | "red"> = {
  open: "gray",
  pending_approval: "yellow",
  assigned: "blue",
  in_progress: "blue",
  done: "green",
  cancelled: "red",
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function JobOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("joborder:read");
  const { id } = await params;
  const job = await getJobOrder(id);
  if (!job) notFound();

  const [units, types, logs, canDelete, canUpdate, canClose] = await Promise.all([
    listUnits(),
    listTaskTypes(),
    listWorkLogs(job.id),
    hasPermission("joborder:delete"),
    hasPermission("joborder:update"),
    hasPermission("joborder:close"),
  ]);

  const canCancel = job.status !== "cancelled" && job.status !== "done";

  return (
    <div>
      <PageHeader
        title={"Job Order #" + job.id.slice(0, 8)}
        description={
          (job.unit_number ? "Unit " + job.unit_number : "") +
          (job.property_name ? " — " + job.property_name : "")
        }
        action={<Badge tone={STATUS_TONE[job.status] ?? "gray"}>{job.status}</Badge>}
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <JobOrderForm mode="edit" job={job} units={units} taskTypes={types} />
          <WorkLogPanel jobOrderId={job.id} logs={logs} />
        </div>
        <div className="space-y-4">
          <div className="bg-white border border-ink-200 rounded-lg p-5 text-sm space-y-2 dark:border-white/[0.06] dark:bg-surface">
            <div className="flex justify-between">
              <span className="text-ink-500">Task type</span>
              <span className="font-medium">{job.task_type_name ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-500">Scheduled</span>
              <span className="font-medium">{formatDate(job.scheduled_date)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-500">Cost estimate</span>
              <span className="font-medium">
                {job.cost_estimate != null ? formatPHP(job.cost_estimate) : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-500">Priority</span>
              <span className="font-medium capitalize">{job.priority}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-500">Created</span>
              <span className="font-medium">{formatDate(job.created_at)}</span>
            </div>
          </div>
          <JobOrderActions job={job} canUpdate={canUpdate} canClose={canClose} />

          {canCancel && (
            <div className="bg-white border border-ink-200 rounded-lg p-5 space-y-2 dark:border-white/[0.06] dark:bg-surface">
              <p className="text-sm font-medium text-ink-700">Danger zone</p>
              <p className="text-xs text-ink-500">
                Cancel keeps the record for auditing. Delete removes it permanently.
              </p>
              <div className="flex flex-col gap-2 pt-1">
                {canClose && <CancelJobOrderButton id={job.id} />}
                {canDelete && <DeleteJobOrderButton id={job.id} />}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
