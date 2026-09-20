import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/guard";
import { listInquiries } from "@/lib/db/inquiries";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { InquiryTable } from "@/components/marketing/inquiry-table";

export default async function InquiriesPage() {
  await requirePagePermission("inquiry:read");
  const inquiries = await listInquiries();
  return (
    <div>
      <PageHeader
        title="Inquiries"
        description="Prospects and their status."
        action={<Link href="/marketing/inquiries/new"><Button>+ New Inquiry</Button></Link>}
      />
      {inquiries.length === 0 ? (
        <EmptyState title="No inquiries" description="Log your first prospect." />
      ) : (
        <InquiryTable inquiries={inquiries} />
      )}
    </div>
  );
}
