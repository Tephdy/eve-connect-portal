import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/guard";
import { getProperty } from "@/lib/db/properties";
import { PageHeader } from "@/components/layout/page-header";
import { PropertyForm } from "@/components/property/property-form";
import { ArchivePropertyButton } from "@/components/property/archive-property-button";

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("property:read");
  const { id } = await params;
  const property = await getProperty(id);
  if (!property) notFound();

  const createdLabel = new Date(property.created_at).toLocaleDateString("en-PH");

  return (
    <div>
      <PageHeader
        title={property.name}
        description={"Created " + createdLabel}
        action={<ArchivePropertyButton id={property.id} />}
      />
      <PropertyForm mode="edit" property={property} />
    </div>
  );
}
