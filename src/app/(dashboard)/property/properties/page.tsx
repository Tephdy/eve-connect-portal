import Link from "next/link";
import { Building2 } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/guard";
import { listProperties } from "@/lib/db/properties";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { PropertyTable } from "@/components/property/property-table";

export default async function PropertiesPage() {
  await requirePagePermission("property:read");
  const properties = await listProperties();

  const total = properties.length;
  const totalUnits = properties.reduce((s, p) => s + (p.total_units ?? 0), 0);
  const residential = properties.filter((p) => p.type === "residential").length;
  const commercial = properties.filter((p) => p.type === "commercial").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Properties"
        description="All properties in the portfolio."
        action={
          <Link href="/property/properties/new">
            <Button>+ New Property</Button>
          </Link>
        }
      />

      {total > 0 && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Total properties" value={total} accent="brand" />
          <StatCard label="Total units" value={totalUnits} accent="purple" />
          <StatCard label="Residential" value={residential} accent="green" />
          <StatCard label="Commercial" value={commercial} accent="yellow" />
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
