import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/guard";
import { getUnit } from "@/lib/db/units";
import { listProperties } from "@/lib/db/properties";
import { PageHeader } from "@/components/layout/page-header";
import { UnitForm } from "@/components/unit/unit-form";

export default async function EditUnitPage({
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
      <Link
        href={"/property/units/" + id}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-ink-500 transition-colors hover:text-ink-800"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to profile
      </Link>
      <PageHeader
        title={"Edit Unit " + unit.unit_number}
        description={unit.property_name ?? ""}
      />
      <UnitForm mode="edit" unit={unit} properties={properties} />
    </div>
  );
}
