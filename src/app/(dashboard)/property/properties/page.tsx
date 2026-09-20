import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/guard";
import { listProperties } from "@/lib/db/properties";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { PropertyTable } from "@/components/property/property-table";

export default async function PropertiesPage() {
  await requirePagePermission("property:read");
  const properties = await listProperties();

  return (
    <div>
      <PageHeader
        title="Properties"
        description="All properties in the portfolio."
        action={
          <Link href="/property/properties/new">
            <Button>+ New Property</Button>
          </Link>
        }
      />
      {properties.length === 0 ? (
        <EmptyState
          title="No properties yet"
          description="Create your first property to get started."
          action={
            <Link href="/property/properties/new">
              <Button>+ New Property</Button>
            </Link>
          }
        />
      ) : (
        <PropertyTable properties={properties} />
      )}
    </div>
  );
}
