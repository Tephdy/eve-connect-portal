import { requirePagePermission } from "@/lib/auth/guard";
import { listDeposits } from "@/lib/db/deposits";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { DepositTable } from "@/components/accounting/deposit-table";

export default async function DepositsPage() {
  await requirePagePermission("deposit:read");
  const deposits = await listDeposits();
  return (
    <div>
      <PageHeader
        title="Deposits"
        description="Security deposits held, refunded, or forfeited."
      />
      {deposits.length === 0 ? (
        <EmptyState
          title="No deposits"
          description="Deposits are created automatically when a lease is signed."
        />
      ) : (
        <DepositTable deposits={deposits} />
      )}
    </div>
  );
}
