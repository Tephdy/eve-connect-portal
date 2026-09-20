import { requirePagePermission } from "@/lib/auth/guard";
import { listUnits } from "@/lib/db/units";
import { PageHeader } from "@/components/layout/page-header";
import { InquiryForm } from "@/components/marketing/inquiry-form";

export default async function NewInquiryPage() {
  await requirePagePermission("inquiry:create");
  const units = await listUnits();
  return (
    <div>
      <PageHeader title="New Inquiry" description="Log a prospect." />
      <InquiryForm mode="create" units={units} />
    </div>
  );
}
