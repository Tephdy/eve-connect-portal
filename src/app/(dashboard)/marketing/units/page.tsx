// @@CONTRACT_ENGINE:marketing-units-page
import { requirePagePermission } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { listUnits } from "@/lib/db/units";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { StatCard } from "@/components/dashboard/stat-card";
import { UnitTable } from "@/components/unit/unit-table";
import { UnitFilters } from "@/components/unit/unit-filters";

export default async function MarketingUnitsPage({
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

  const [allUnits, propertiesRes] = await Promise.all([
    listUnits(),
    supabase
      .from("property")
      .select("id, name")
      .is("archived_at", null)
      .order("name"),
  ]);

  const properties = (propertiesRes.data ?? []) as { id: string; name: string }[];

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

  // ---- KPI stats (unfiltered) ----
  const total = allUnits.length;
  const vacant = allUnits.filter((u) => u.status === "vacant").length;
  const occupied = allUnits.filter((u) => u.status === "occupied").length;
  const reserved = allUnits.filter((u) => u.status === "reserved").length;

  const bedroomSet = new Set<number>();
  for (const u of allUnits) {
    if (u.bedrooms != null) bedroomSet.add(Number(u.bedrooms));
  }
  const bedroomsOptions = Array.from(bedroomSet).sort((a, b) => a - b);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Units"
        description="Unit inventory across all properties."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard label="Total units" value={String(total)} />
        <StatCard label="Vacant" value={String(vacant)} />
        <StatCard label="Occupied" value={String(occupied)} />
        <StatCard label="Reserved" value={String(reserved)} />
      </div>

      <UnitFilters properties={properties} bedroomsOptions={bedroomsOptions} />

      {units.length === 0 ? (
        <EmptyState
          title="No units match your filters"
          description="Try adjusting the search or filter criteria."
        />
      ) : (
        <UnitTable units={units} />
      )}
    </div>
  );
}
