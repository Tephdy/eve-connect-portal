import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/guard";
import { listJobOrders } from "@/lib/db/job-orders";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { JobOrderTable } from "@/components/maintenance/job-order-table";

export default async function MaintenanceHome() {
  await requirePagePermission("joborder:read");
  const jobs = await listJobOrders();

  return (
    <div>
      <PageHeader
        title="Maintenance"
        description="Job orders, work logs, and assets."
        action={<Link href="/maintenance/job-orders/new"><Button>+ New Job Order</Button></Link>}
      />

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500">Open</p>
          <p className="text-2xl font-semibold">{jobs.filter((j) => j.status === "open").length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500">Pending approval</p>
          <p className="text-2xl font-semibold text-yellow-600">
            {jobs.filter((j) => j.status === "pending_approval").length}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500">In progress</p>
          <p className="text-2xl font-semibold text-blue-600">
            {jobs.filter((j) => j.status === "in_progress" || j.status === "assigned").length}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500">Done</p>
          <p className="text-2xl font-semibold text-green-600">
            {jobs.filter((j) => j.status === "done").length}
          </p>
        </div>
      </div>

      {jobs.length === 0 ? (
        <EmptyState
          title="No job orders yet"
          description="Create your first job order."
          action={<Link href="/maintenance/job-orders/new"><Button>+ New Job Order</Button></Link>}
        />
      ) : (
        <JobOrderTable jobs={jobs} />
      )}
    </div>
  );
}
