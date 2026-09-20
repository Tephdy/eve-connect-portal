import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/guard";
import { getUnit } from "@/lib/db/units";
import { listProperties } from "@/lib/db/properties";
import { PageHeader } from "@/components/layout/page-header";
import { UnitForm } from "@/components/unit/unit-form";

export default async function UnitDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("unit:read");
  const { id } = await params;
  const unit = await getUnit(id);
  if (!unit) notFound();
  const properties = await listProperties();

  return (
    <div>
      <PageHeader
        title={"Unit " + unit.unit_number}
        description={unit.property_name ?? ""}
      />
      <UnitForm mode="edit" unit={unit} properties={properties} />
    </div>
  );
}
