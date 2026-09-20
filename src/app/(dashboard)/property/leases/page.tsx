import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/guard";
import { listLeases } from "@/lib/db/leases";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/dashboard/stat-card";
import { LeaseTable } from "@/components/lease/lease-table";

export default async function LeasesPage() {
  await requirePagePermission("lease:read");
  const leases = await listLeases();

  const total = leases.length;
  const active = leases.filter((l) => l.status === "active").length;
  const expiring = leases.filter((l) => l.status === "expiring").length;
  const terminated = leases.filter((l) => l.status === "terminated").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leases"
        description="All lease agreements."
        action={
          <Link href="/property/leases/new">
            <Button>+ New Lease</Button>
          </Link>
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

      {leases.length === 0 ? (
        <EmptyState
          title="No leases yet"
          description="Create your first lease to get started."
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
