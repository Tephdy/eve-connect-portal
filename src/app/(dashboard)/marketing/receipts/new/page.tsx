import { requirePagePermission } from "@/lib/auth/guard";
import { listTenants } from "@/lib/db/tenants";
import { listReservations } from "@/lib/db/unit-reservations";
import { PageHeader } from "@/components/layout/page-header";
import { ReceiptUploadForm } from "@/components/receipts/upload-form";

export default async function MarketingNewReceiptPage() {
  await requirePagePermission("payment:read");
  const [tenants, allReservations] = await Promise.all([
    listTenants(),
    listReservations({ open_only: true }),
  ]);

  const reservations = (allReservations as any[]).map((r) => ({
    id: r.id,
    client_name: r.client_name,
    unit_number: r.unit_number,
    property_name: r.property_name,
  }));
  return (
    <div className="space-y-6">
      <PageHeader
        title="Upload Receipt"
        description="File a reservation fee or other marketing receipt to Google Drive."
      />
      <ReceiptUploadForm tenants={tenants} reservations={reservations} mode="marketing" />
    </div>
  );
}
