import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/guard";
import { listLeases } from "@/lib/db/leases";
import { listProperties } from "@/lib/db/properties";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/dashboard/stat-card";
import { LeaseTable } from "@/components/lease/lease-table";
import { LeaseFilters } from "@/components/lease/lease-filters";

export default async function LeasesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    term?: string;
    property?: string;
    ends_before?: string;
  }>;
}) {
  await requirePagePermission("lease:read");
  const sp = await searchParams;

  const leases = await listLeases({
    status: (sp.status as never) ?? "all",
    term: sp.term ?? "all",
    property_id: sp.property ?? "all",
    q: sp.q ?? "",
    ends_before: sp.ends_before ?? "",
  });

  // Stats reflect the full set, not the filtered view.
  const all = await listLeases();
  const total = all.length;
  const active = all.filter((l) => l.status === "active").length;
  const expiring = all.filter((l) => l.status === "expiring").length;
  const terminated = all.filter((l) => l.status === "terminated").length;

  const properties = await listProperties();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leases"
        description="All lease agreements."
        action={
          <div className="flex gap-2">
            <Link href="/property/import">
              <Button variant="secondary">Import</Button>
            </Link>
            <Link href="/property/leases/new">
              <Button>+ New Lease</Button>
            </Link>
          </div>
        }
      />

      {total > 0 && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Total leases" value={total} accent="brand" />
          <StatCard label="Active" value={active} accent="green" />
          <StatCard label="Expiring" value={expiring} accent="yellow" />
          <StatCard label="Terminated" value={terminated} accent="red" />
        </div>
      )}

      <LeaseFilters
        properties={properties.map((p) => ({ id: p.id, name: p.name }))}
      />

      {leases.length === 0 ? (
        <EmptyState
          title="No leases match"
          description="Adjust your filters, or create a new lease."
          action={
            <Link href="/property/leases/new">
              <Button>+ New Lease</Button>
            </Link>
          }
        />
      ) : (
        <LeaseTable leases={leases} />
      )}
    </div>
  );
}
