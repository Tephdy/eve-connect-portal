import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/guard";
import { listProperties } from "@/lib/db/properties";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/dashboard/stat-card";
import { PropertyTable } from "@/components/property/property-table";

export default async function PropertiesPage() {
  await requirePagePermission("property:read");
  const properties = await listProperties();

  const total = properties.length;
  const totalUnits = properties.reduce((s, p) => s + (p.total_units ?? 0), 0);
  const studio = properties.filter((p) => p.type === "studio_unit").length;
  const bedrooms = properties.filter((p) => p.type === "one_two_bedroom").length;
  const bedspace = properties.filter((p) => p.type === "bedspace").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Properties"
        description="All properties in the portfolio."
        action={
          <div className="flex gap-2"><Link href="/property/import"><Button variant="secondary">Import</Button></Link><Link href="/property/properties/new">
            <Button>+ New Property</Button>
          </Link></div>
        }
      />

      {total > 0 && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Total properties" value={total} accent="brand" />
          <StatCard label="Total units" value={totalUnits} accent="purple" />
          <StatCard label="Studio units" value={studio} accent="green" />
          <StatCard label="1 & 2 Bedroom" value={bedrooms} accent="yellow" />
        </div>
      )}

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