import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/guard";
import { listContracts } from "@/lib/db/contracts";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { ContractTable } from "@/components/contract/contract-table";

export default async function ContractsPage() {
  await requirePagePermission("contract:read");
  const contracts = await listContracts();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contracts"
        description="Generated lease contracts and their signatures."
        action={
          <Link href="/property/contracts/new">
            <Button>+ Generate Contract</Button>
          </Link>
        }
      />

      {contracts.length === 0 ? (
        <EmptyState
          title="No contracts yet"
          description="Generate a contract from a lease and a template."
          action={
            <Link href="/property/contracts/new">
              <Button>+ Generate Contract</Button>
            </Link>
          }
        />
      ) : (
        <ContractTable contracts={contracts} />
      )}
    </div>
  );
}
