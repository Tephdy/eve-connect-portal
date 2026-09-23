import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/guard";
import { getInquiry } from "@/lib/db/inquiries";
import { listUnits } from "@/lib/db/units";
import { PageHeader } from "@/components/layout/page-header";
import { InquiryForm } from "@/components/marketing/inquiry-form";

export default async function InquiryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("inquiry:read");
  const { id } = await params;
  const inquiry = await getInquiry(id);
  if (!inquiry) notFound();
  const units = await listUnits();
  return (
    <div>
      <PageHeader
        title={inquiry.prospect_name}
        description={[inquiry.contact, inquiry.email].filter(Boolean).join(" · ")}
      />
      <InquiryForm mode="edit" inquiry={inquiry} units={units} />
    </div>
  );
}
