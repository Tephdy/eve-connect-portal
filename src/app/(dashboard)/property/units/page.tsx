import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { listUnits } from "@/lib/db/units";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/dashboard/stat-card";
import { UnitTable } from "@/components/unit/unit-table";
import { UnitFilters } from "@/components/unit/unit-filters";

export default async function UnitsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    property?: string;
    status?: string;
    bedrooms?: string;
  }>;
}) {
  await requirePagePermission("unit:read");
  const sp = await searchParams;

  const supabase = await createClient();

  const [allUnits, properties] = await Promise.all([
    listUnits(),
    supabase
      .from("property")
      .select("id, name")
      .is("archived_at", null)
      .order("name"),
  ]);

  // ---- Apply filters ----
  const q = (sp.q ?? "").trim().toLowerCase();
  const property = sp.property ?? "";
  const status = sp.status ?? "";
  const bedrooms = sp.bedrooms ?? "";

  const units = allUnits.filter((u) => {
    if (q && !u.unit_number.toLowerCase().includes(q)) return false;
    if (property && u.property_id !== property) return false;
    if (status && u.status !== status) return false;
    if (bedrooms) {
      const b = Number(bedrooms);
      if (Number(u.bedrooms ?? 0) !== b) return false;
    }
    return true;
  });

  // ---- KPI stats (unfiltered, so users see total portfolio) ----
  const total = allUnits.length;
  const vacant = allUnits.filter((u) => u.status === "vacant").length;
  const occupied = allUnits.filter((u) => u.status === "occupied").length;
  const maintenance = allUnits.filter((u) => u.status === "maintenance").length;

  // ---- Bedroom options for filter ----
  const bedroomsOptions = Array.from(
    new Set(
      allUnits
        .map((u) => Number(u.bedrooms ?? 0))
        .filter((n) => Number.isFinite(n) && n >= 0)
    )
  ).sort((a, b) => a - b);

  const hasFilters = !!(q || property || status || bedrooms);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Units"
        description="All units across properties."
        action={
          <div className="flex gap-2">
            <Link href="/property/import">
              <Button variant="secondary">Import</Button>
            </Link>
            <Link href="/property/units/new">
              <Button>+ New Unit</Button>
            </Link>
          </div>
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

      <UnitFilters
        properties={properties.data ?? []}
        bedroomsOptions={bedroomsOptions}
      />

      {hasFilters && (
        <p className="text-sm text-ink-500">
          Showing <strong className="text-ink-900">{units.length}</strong> of{" "}
          {total} units
        </p>
      )}

      {allUnits.length === 0 ? (
        <EmptyState
          title="No units yet"
          description="Create your first unit to get started."
          action={
            <Link href="/property/units/new">
              <Button>+ New Unit</Button>
            </Link>
          }
        />
      ) : units.length === 0 ? (
        <EmptyState
          title="No units match the filters"
          description="Try adjusting or clearing the filters."
        />
      ) : (
        <UnitTable units={units} />
      )}
    </div>
  );
}
