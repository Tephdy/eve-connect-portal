import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/guard";
import { listTenants } from "@/lib/db/tenants";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/dashboard/stat-card";
import { TenantTable } from "@/components/tenant/tenant-table";

export default async function TenantsPage() {
  await requirePagePermission("tenant:read");
  const tenants = await listTenants();

  const total = tenants.length;
  const active = tenants.filter((t) => t.status === "active").length;
  const prospects = tenants.filter((t) => t.status === "prospect").length;
  const former = tenants.filter((t) => t.status === "former").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tenants"
        description="All tenants and prospects."
        action={
          <Link href="/property/tenants/new">
            <Button>+ New Tenant</Button>
          </Link>
        }
      />

      {total > 0 && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Total tenants" value={total} accent="brand" />
          <StatCard label="Active" value={active} accent="green" />
          <StatCard label="Prospects" value={prospects} accent="yellow" />
          <StatCard label="Former" value={former} accent="purple" />
        </div>
      )}

      {tenants.length === 0 ? (
        <EmptyState
          title="No tenants yet"
          description="Add your first tenant to get started."
          action={
            <Link href="/property/tenants/new">
              <Button>+ New Tenant</Button>
            </Link>
          }
        />
      ) : (
        <TenantTable tenants={tenants} />
      )}
    </div>
  );
}
