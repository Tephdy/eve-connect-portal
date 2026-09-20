import { requirePagePermission } from "@/lib/auth/guard";
import { listUnits } from "@/lib/db/units";
import { listTenants } from "@/lib/db/tenants";
import { PageHeader } from "@/components/layout/page-header";
import { LeaseForm } from "@/components/lease/lease-form";

export default async function NewLeasePage() {
  await requirePagePermission("lease:create");
  const [units, tenants] = await Promise.all([listUnits(), listTenants()]);
  return (
    <div>
      <PageHeader title="New Lease" description="Create a lease agreement." />
      <LeaseForm mode="create" units={units} tenants={tenants} />
    </div>
  );
}
