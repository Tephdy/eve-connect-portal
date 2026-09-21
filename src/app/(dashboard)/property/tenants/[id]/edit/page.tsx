import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/guard";
import { getTenant } from "@/lib/db/tenants";
import { PageHeader } from "@/components/layout/page-header";
import { TenantForm } from "@/components/tenant/tenant-form";

export default async function EditTenantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("tenant:read");
  const { id } = await params;
  const tenant = await getTenant(id);
  if (!tenant) notFound();

  return (
    <div>
      <Link
        href={"/property/tenants/" + id}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-ink-500 transition-colors hover:text-ink-800"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to profile
      </Link>
      <PageHeader title={"Edit " + tenant.full_name} />
      <TenantForm mode="edit" tenant={tenant} />
    </div>
  );
}
