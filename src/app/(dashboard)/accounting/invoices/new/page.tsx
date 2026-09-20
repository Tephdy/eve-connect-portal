import { requirePagePermission } from "@/lib/auth/guard";
import { listLeases } from "@/lib/db/leases";
import { PageHeader } from "@/components/layout/page-header";
import { InvoiceForm } from "@/components/accounting/invoice-form";

export default async function NewInvoicePage() {
  await requirePagePermission("invoice:create");
  const leases = await listLeases();
  return (
    <div>
      <PageHeader title="New Invoice" description="Create a manual invoice." />
      <InvoiceForm leases={leases} />
    </div>
  );
}
