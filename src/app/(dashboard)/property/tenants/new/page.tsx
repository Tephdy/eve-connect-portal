import { requirePagePermission } from "@/lib/auth/guard";
import { PageHeader } from "@/components/layout/page-header";
import { TenantForm } from "@/components/tenant/tenant-form";
import { listReservations } from "@/lib/db/unit-reservations";

export default async function NewTenantPage() {
  await requirePagePermission("tenant:create");
  const reservations = await listReservations({ open_only: true });
  return (
    <div>
      <PageHeader title="New Tenant" description="Add a tenant or prospect." />
      <TenantForm mode="create" reservations={reservations} />
    </div>
  );
}
