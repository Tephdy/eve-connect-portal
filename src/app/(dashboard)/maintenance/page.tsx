import Link from "next/link";
import { Wrench, Package, Settings2, ArrowRight } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/guard";
import { listJobOrders } from "@/lib/db/job-orders";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { JobOrderTable } from "@/components/maintenance/job-order-table";

export default async function MaintenanceHome() {
  await requirePagePermission("joborder:read");
  const jobs = await listJobOrders();

  const open = jobs.filter((j) => j.status === "open").length;
  const pending = jobs.filter((j) => j.status === "pending_approval").length;
  const inProgress = jobs.filter((j) => j.status === "in_progress" || j.status === "assigned").length;
  const done = jobs.filter((j) => j.status === "done").length;

  const urgent = jobs.filter((j) => j.priority === "urgent" && j.status !== "done" && j.status !== "cancelled").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Maintenance"
        description="Job orders, work logs, and assets."
        action={
          <Link href="/maintenance/job-orders/new">
            <Button>+ New Job Order</Button>
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Open"
          value={open}
          accent="brand"
          deltaLabel={urgent > 0 ? urgent + " urgent" : "no urgent"}
        />
        <StatCard
          label="Pending approval"
          value={pending}
          accent="yellow"
          deltaLabel="awaiting accounting"
        />
        <StatCard
          label="In progress"
          value={inProgress}
          accent="purple"
          deltaLabel="active jobs"
        />
        <StatCard
          label="Completed"
          value={done}
          accent="green"
          deltaLabel="all time"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <QuickCard
          href="/maintenance/job-orders/new"
          icon={Wrench}
          title="New Job Order"
          description="Log a maintenance request."
        />
        <QuickCard
          href="/maintenance/assets"
          icon={Package}
          title="Assets"
          description="Track equipment by unit."
        />
        <QuickCard
          href="/maintenance/task-types"
          icon={Settings2}
          title="Task Types"
          description="Approval thresholds per category."
        />
      </div>

      {jobs.length === 0 ? (
        <EmptyState
          title="No job orders yet"
          description="Create your first job order to get started."
          action={
            <Link href="/maintenance/job-orders/new">
              <Button>+ New Job Order</Button>
            </Link>
          }
        />
      ) : (
        <JobOrderTable jobs={jobs} />
      )}
    </div>
  );
}

function QuickCard({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <Link href={href} className="group">
      <Card interactive className="h-full">
        <CardBody className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 transition-colors group-hover:bg-brand-500 group-hover:text-white dark:text-brand-400">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 font-semibold text-ink-900">
              {title}
              <ArrowRight className="h-3.5 w-3.5 text-ink-400 transition-transform group-hover:translate-x-0.5" />
            </p>
            <p className="mt-0.5 text-sm text-ink-500">{description}</p>
          </div>
        </CardBody>
      </Card>
    </Link>
  );
}
