import { requirePagePermission } from "@/lib/auth/guard";
import { listReceipts } from "@/lib/db/receipts";
import { PageHeader } from "@/components/layout/page-header";
import { ReceiptTable } from "@/components/receipts/receipt-table";
import { ReceiptFilters } from "@/components/receipts/receipt-filters";
import { listProperties } from "@/lib/db/properties";

export default async function AccountingReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; property?: string; payment?: string; month?: string }>;
}) {
  await requirePagePermission("payment:read");
  const sp = await searchParams;
  const [receipts, properties] = await Promise.all([
    listReceipts({
      q: sp.q ?? "",
      property_id: sp.property ?? undefined,
      payment: sp.payment ?? "all",
      month: sp.month ?? "",
    }),
    listProperties(),
  ]);;
  return (
    <div className="space-y-6">
      <PageHeader title="Tenant Receipts" description="Receipts filed by property representatives." />
      <ReceiptFilters
        properties={properties.map((p) => ({ id: p.id, name: p.name }))}
      />
      <ReceiptTable rows={receipts} />
    </div>
  );
}
