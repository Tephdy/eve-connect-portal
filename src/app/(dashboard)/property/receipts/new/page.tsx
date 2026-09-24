import { requirePagePermission } from "@/lib/auth/guard";
import { listTenants } from "@/lib/db/tenants";
import { PageHeader } from "@/components/layout/page-header";
import { ReceiptUploadForm } from "@/components/receipts/upload-form";

export default async function NewReceiptPage() {
  await requirePagePermission("payment:read");
  const tenants = await listTenants();
  return (
    <div className="space-y-6">
      <PageHeader title="Upload Receipt" description="File a tenant receipt to Google Drive." />
      <ReceiptUploadForm tenants={tenants} />
    </div>
  );
}
