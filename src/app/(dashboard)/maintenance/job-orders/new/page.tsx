import { requirePagePermission } from "@/lib/auth/guard";
import { listUnits } from "@/lib/db/units";
import { listTaskTypes } from "@/lib/db/job-task-types";
import { PageHeader } from "@/components/layout/page-header";
import { JobOrderForm } from "@/components/maintenance/job-order-form";

export default async function NewJobOrderPage() {
  await requirePagePermission("joborder:create");
  const [units, types] = await Promise.all([listUnits(), listTaskTypes()]);
  return (
    <div>
      <PageHeader title="New Job Order" description="Log a maintenance request." />
      <JobOrderForm mode="create" units={units} taskTypes={types} />
    </div>
  );
}
