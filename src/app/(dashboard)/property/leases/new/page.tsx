import { requirePagePermission } from "@/lib/auth/guard";
import { listUnits } from "@/lib/db/units";
import { listTenants } from "@/lib/db/tenants";
import { listProperties } from "@/lib/db/properties";
import { PageHeader } from "@/components/layout/page-header";
import { LeaseForm } from "@/components/lease/lease-form";
import { listReservations } from "@/lib/db/unit-reservations";

export default async function NewLeasePage() {
  await requirePagePermission("lease:create");
  const [units, tenants, properties, allReservations] = await Promise.all([
    listUnits(),
    listTenants(),
    listProperties(),
    listReservations({ open_only: true }),
  ]);

  // Only verified + still-draft reservations can seed a lease.
  const reservations = (allReservations as any[]).filter(
    (r) => r.verification_status === "verified" && r.lease_status === "draft"
  );

  return (
    <div>
      <PageHeader title="New Lease" description="Create a lease agreement." />
      <LeaseForm
        mode="create"
        units={units}
        tenants={tenants}
        properties={properties}
        reservations={reservations}
      />
    </div>
  );
}
