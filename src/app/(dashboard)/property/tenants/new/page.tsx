import { requirePagePermission } from "@/lib/auth/guard";
import { PageHeader } from "@/components/layout/page-header";
import { TenantForm } from "@/components/tenant/tenant-form";

export default async function NewTenantPage() {
  await requirePagePermission("tenant:create");
  return (
    <div>
      <PageHeader title="New Tenant" description="Add a tenant or prospect." />
      <TenantForm mode="create" />
    </div>
  );
}
