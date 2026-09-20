import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/guard";
import { listInquiries } from "@/lib/db/inquiries";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/dashboard/stat-card";
import { InquiryTable } from "@/components/marketing/inquiry-table";

export default async function InquiriesPage() {
  await requirePagePermission("inquiry:read");
  const inquiries = await listInquiries();

  const total = inquiries.length;
  const open = inquiries.filter((i) => i.status === "open").length;
  const contacted = inquiries.filter((i) => i.status === "contacted").length;
  const converted = inquiries.filter((i) => i.status === "converted").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inquiries"
        description="Prospects and their status."
        action={
          <Link href="/marketing/inquiries/new">
            <Button>+ New Inquiry</Button>
          </Link>
        }
      />

      {total > 0 && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Total inquiries" value={total} accent="brand" />
          <StatCard label="Open" value={open} accent="yellow" />
          <StatCard label="Contacted" value={contacted} accent="purple" />
          <StatCard label="Converted" value={converted} accent="green" />
        </div>
      )}

      {inquiries.length === 0 ? (
        <EmptyState
          title="No inquiries"
          description="Log your first prospect."
          action={
            <Link href="/marketing/inquiries/new">
              <Button>+ New Inquiry</Button>
            </Link>
          }
        />
      ) : (
        <InquiryTable inquiries={inquiries} />
      )}
    </div>
  );
}
