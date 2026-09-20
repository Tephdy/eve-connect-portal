import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/guard";
import { listTenants } from "@/lib/db/tenants";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { TenantTable } from "@/components/tenant/tenant-table";

export default async function TenantsPage() {
  await requirePagePermission("tenant:read");
  const tenants = await listTenants();
  return (
    <div>
      <PageHeader
        title="Tenants"
        description="All tenants and prospects."
        action={<Link href="/property/tenants/new"><Button>+ New Tenant</Button></Link>}
      />
      {tenants.length === 0 ? (
        <EmptyState
          title="No tenants yet"
          description="Add your first tenant to get started."
          action={<Link href="/property/tenants/new"><Button>+ New Tenant</Button></Link>}
        />
      ) : (
        <TenantTable tenants={tenants} />
      )}
    </div>
  );
}
