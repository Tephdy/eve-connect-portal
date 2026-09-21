import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/guard";
import { getProperty } from "@/lib/db/properties";
import { PageHeader } from "@/components/layout/page-header";
import { PropertyForm } from "@/components/property/property-form";
import { ArchivePropertyButton } from "@/components/property/archive-property-button";

export default async function EditPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("property:read");
  const { id } = await params;
  const property = await getProperty(id);
  if (!property) notFound();

  return (
    <div>
      <Link
        href={"/property/properties/" + id}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-ink-500 transition-colors hover:text-ink-800"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to profile
      </Link>
      <PageHeader
        title={property.name}
        description="Edit property details"
        action={<ArchivePropertyButton id={property.id} />}
      />
      <PropertyForm mode="edit" property={property} />
    </div>
  );
}
