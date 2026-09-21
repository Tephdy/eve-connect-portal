import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/guard";
import { getLease } from "@/lib/db/leases";
import { listUnits } from "@/lib/db/units";
import { listTenants } from "@/lib/db/tenants";
import { listProperties } from "@/lib/db/properties";
import { PageHeader } from "@/components/layout/page-header";
import { LeaseForm } from "@/components/lease/lease-form";
import { TerminateLeaseButton } from "@/components/lease/terminate-lease-button";

export default async function LeaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("lease:read");
  const { id } = await params;
  const lease = await getLease(id);
  if (!lease) notFound();

  const [units, tenants, properties] = await Promise.all([
    listUnits(),
    listTenants(),
    listProperties(),
  ]);

  return (
    <div>
      <PageHeader
        title={"Lease for Unit " + (lease.unit_number ?? "")}
        description={lease.tenant_name ?? ""}
        action={lease.status !== "terminated" ? <TerminateLeaseButton id={lease.id} /> : undefined}
      />
      <LeaseForm
        mode="edit"
        lease={lease}
        units={units}
        tenants={tenants}
        properties={properties}
      />
    </div>
  );
}
