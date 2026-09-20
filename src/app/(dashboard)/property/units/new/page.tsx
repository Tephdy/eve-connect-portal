import { requirePagePermission } from "@/lib/auth/guard";
import { PageHeader } from "@/components/layout/page-header";
import { UnitForm } from "@/components/unit/unit-form";
import { listProperties } from "@/lib/db/properties";

export default async function NewUnitPage() {
  await requirePagePermission("unit:create");
  const properties = await listProperties();
  return (
    <div>
      <PageHeader title="New Unit" description="Add a unit to a property." />
      <UnitForm mode="create" properties={properties} />
    </div>
  );
}
