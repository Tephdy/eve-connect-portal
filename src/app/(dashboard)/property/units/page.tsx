import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/guard";
import { listUnits } from "@/lib/db/units";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { UnitTable } from "@/components/unit/unit-table";

export default async function UnitsPage() {
  await requirePagePermission("unit:read");
  const units = await listUnits();
  return (
    <div>
      <PageHeader
        title="Units"
        description="All units across properties."
        action={
          <Link href="/property/units/new">
            <Button>+ New Unit</Button>
          </Link>
        }
      />
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
