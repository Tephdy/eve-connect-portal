import { requirePagePermission } from "@/lib/auth/guard";
import { PageHeader } from "@/components/layout/page-header";
import { PropertyForm } from "@/components/property/property-form";

export default async function NewPropertyPage() {
  await requirePagePermission("property:create");
  return (
    <div>
      <PageHeader
        title="New Property"
        description="Add a property to the portfolio."
      />
      <PropertyForm mode="create" />
    </div>
  );
}
