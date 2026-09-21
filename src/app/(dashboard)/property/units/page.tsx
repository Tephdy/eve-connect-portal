import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/guard";
import { listUnits } from "@/lib/db/units";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/dashboard/stat-card";
import { UnitTable } from "@/components/unit/unit-table";

export default async function UnitsPage() {
  await requirePagePermission("unit:read");
  const units = await listUnits();

  const total = units.length;
  const vacant = units.filter((u) => u.status === "vacant").length;
  const occupied = units.filter((u) => u.status === "occupied").length;
  const maintenance = units.filter((u) => u.status === "maintenance").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Units"
        description="All units across properties."
        action={
          <div className="flex gap-2"><Link href="/property/import"><Button variant="secondary">Import</Button></Link><Link href="/property/units/new">
            <Button>+ New Unit</Button>
          </Link></div>
        }
      />

      {total > 0 && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Total units" value={total} accent="brand" />
          <StatCard label="Vacant" value={vacant} accent="green" />
          <StatCard label="Occupied" value={occupied} accent="purple" />
          <StatCard label="Maintenance" value={maintenance} accent="yellow" />
        </div>
      )}

      {units.length === 0 ? (
        <EmptyState
          title="No units yet"
          description="Create your first unit to get started."
          action={
            <Link href="/property/units/new">
              <Button>+ New Unit</Button>
            </Link>
          }
        />
      ) : (
        <UnitTable units={units} />
      )}
    </div>
  );
}
