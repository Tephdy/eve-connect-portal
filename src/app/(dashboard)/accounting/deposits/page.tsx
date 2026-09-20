import { requirePagePermission } from "@/lib/auth/guard";
import { listDeposits } from "@/lib/db/deposits";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { StatCard } from "@/components/dashboard/stat-card";
import { DepositTable } from "@/components/accounting/deposit-table";
import { formatPHP } from "@/lib/utils/format-php";

export default async function DepositsPage() {
  await requirePagePermission("deposit:read");
  const deposits = await listDeposits();

  const held = deposits.filter((d) => d.status === "held" || d.status === "partial");
  const heldTotal = held.reduce((s, d) => s + Number(d.amount), 0);
  const returned = deposits.filter((d) => d.status === "returned");
  const returnedTotal = returned.reduce((s, d) => s + Number(d.refunded_amount), 0);
  const forfeited = deposits.filter((d) => d.status === "forfeited");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Deposits"
        description="Security deposits held, refunded, or forfeited."
      />

      {deposits.length > 0 && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Held"
            value={formatPHP(heldTotal)}
            accent="yellow"
            deltaLabel={held.length + " active"}
          />
          <StatCard
            label="Returned"
            value={formatPHP(returnedTotal)}
            accent="green"
            deltaLabel={returned.length + " refunded"}
          />
          <StatCard
            label="Forfeited"
            value={forfeited.length}
            accent="red"
          />
          <StatCard
            label="Total deposits"
            value={deposits.length}
            accent="brand"
          />
        </div>
      )}

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
