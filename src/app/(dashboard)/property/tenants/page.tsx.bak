import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/guard";
import { listTenants } from "@/lib/db/tenants";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/dashboard/stat-card";
import { TenantTable } from "@/components/tenant/tenant-table";
import { TenantFilters } from "@/components/tenant/tenant-filters";

export default async function TenantsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    messenger?: string;
    email?: string;
  }>;
}) {
  await requirePagePermission("tenant:read");
  const sp = await searchParams;

  const allTenants = await listTenants();

  // ---- Apply filters ----
  const q = (sp.q ?? "").trim().toLowerCase();
  const status = sp.status ?? "";
  const hasMessenger = sp.messenger === "1";
  const hasEmail = sp.email === "1";

  const tenants = allTenants.filter((t) => {
    if (q) {
      const hay = (
        (t.full_name ?? "") +
        " " +
        (t.email ?? "") +
        " " +
        (t.phone ?? "") +
        " " +
        (t.messenger_name ?? "")
      ).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (status && t.status !== status) return false;
    if (hasMessenger && !t.messenger_name) return false;
    if (hasEmail && !t.email) return false;
    return true;
  });

  // ---- KPI stats (unfiltered) ----
  const total = allTenants.length;
  const active = allTenants.filter((t) => t.status === "active").length;
  const prospects = allTenants.filter((t) => t.status === "prospect").length;
  const former = allTenants.filter((t) => t.status === "former").length;

  const hasFilters = !!(q || status || hasMessenger || hasEmail);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tenants"
        description="All tenants and prospects."
        action={
          <div className="flex gap-2">
            <Link href="/property/import">
              <Button variant="secondary">Import</Button>
            </Link>
            <Link href="/property/tenants/new">
              <Button>+ New Tenant</Button>
            </Link>
          </div>
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

      <TenantFilters />

      {hasFilters && (
        <p className="text-sm text-ink-500">
          Showing <strong className="text-ink-900">{tenants.length}</strong> of{" "}
          {total} tenants
        </p>
      )}

      {allTenants.length === 0 ? (
        <EmptyState
          title="No tenants yet"
          description="Add your first tenant to get started."
          action={
            <Link href="/property/tenants/new">
              <Button>+ New Tenant</Button>
            </Link>
          }
        />
      ) : tenants.length === 0 ? (
        <EmptyState
          title="No tenants match the filters"
          description="Try adjusting or clearing the filters."
        />
      ) : (
        <TenantTable tenants={tenants} />
      )}
    </div>
  );
}
