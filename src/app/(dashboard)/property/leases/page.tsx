import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/guard";
import { listLeases } from "@/lib/db/leases";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { LeaseTable } from "@/components/lease/lease-table";

export default async function LeasesPage() {
  await requirePagePermission("lease:read");
  const leases = await listLeases();
  return (
    <div>
      <PageHeader
        title="Leases"
        description="All lease agreements."
        action={<Link href="/property/leases/new"><Button>+ New Lease</Button></Link>}
      />
      {leases.length === 0 ? (
        <EmptyState
          title="No leases yet"
          description="Create your first lease to get started."
          action={<Link href="/property/leases/new"><Button>+ New Lease</Button></Link>}
        />
      ) : (
        <LeaseTable leases={leases} />
      )}
    </div>
  );
}
