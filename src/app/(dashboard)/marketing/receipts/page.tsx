import Link from "next/link";
import { Upload } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/guard";
import { listReceipts } from "@/lib/db/receipts";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ReceiptTable } from "@/components/receipts/receipt-table";

export default async function MarketingReceiptsPage() {
  await requirePagePermission("payment:read");
  const receipts = await listReceipts({});
  return (
    <div className="space-y-6">
      <PageHeader
        title="Receipts"
        description="Receipts filed by marketing (reservation fees, etc.)."
        action={
          <Link href="/marketing/receipts/new">
            <Button>
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              Upload receipt
            </Button>
          </Link>
        }
      />
      <ReceiptTable rows={receipts} />
    </div>
  );
}
