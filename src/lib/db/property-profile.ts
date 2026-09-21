import "server-only";
import { createClient } from "@/lib/supabase/server";

export type PropertyProfile = {
  property: {
    id: string;
    name: string;
    address: string | null;
    type: string;
    total_units: number;
    created_at: string;
    archived_at: string | null;
  };
  units: Array<{
    id: string;
    unit_number: string;
    floor: number | null;
    bedrooms: number | null;
    bathrooms: number | null;
    area_sqm: number | null;
    base_rent: number | null;
    status: string;
  }>;
  leases: Array<{
    id: string;
    unit_id: string;
    unit_number: string | null;
    tenant_id: string;
    tenant_name: string | null;
    start_date: string;
    end_date: string;
    monthly_rent: number;
    status: string;
    term: string | null;
  }>;
  activity: Array<{
    id: string;
    action: string;
    entity_type: string;
    entity_id: string;
    created_at: string;
    reason: string | null;
  }>;
  stats: {
    total_units: number;
    occupied: number;
    vacant: number;
    maintenance: number;
    occupancy_pct: number;
    monthly_revenue: number;
    active_leases: number;
  };
};

export async function getPropertyProfile(id: string): Promise<PropertyProfile | null> {
  const supabase = await createClient();

  const { data: property } = await supabase
    .from("property")
    .select("id, name, address, type, total_units, created_at, archived_at")
    .eq("id", id)
    .maybeSingle();

  if (!property) return null;

  const { data: units } = await supabase
    .from("unit")
    .select("id, unit_number, floor, bedrooms, bathrooms, area_sqm, base_rent, status")
    .eq("property_id", id)
    .order("unit_number");

  const unitRows = (units ?? []) as any[];
  const unitIds = unitRows.map((u) => u.id);

  let leases: any[] = [];
  if (unitIds.length > 0) {
    const { data } = await supabase
      .from("lease")
      .select(
        "id, unit_id, unit_number, tenant_id, tenant_name, start_date, end_date, monthly_rent, status, term"
      )
      .in("unit_id", unitIds)
      .order("start_date", { ascending: false });
    leases = data ?? [];
  }

  const entityIds = [id, ...unitIds];

  const { data: activity } = entityIds.length > 0
    ? await supabase
        .from("audit_log")
        .select("id, action, entity_type, entity_id, created_at, reason")
        .in("entity_id", entityIds)
        .order("created_at", { ascending: false })
        .limit(30)
    : { data: [] as any[] };

  const total_units = unitRows.length;
  const occupied = unitRows.filter((u) => u.status === "occupied").length;
  const vacant = unitRows.filter((u) => u.status === "vacant").length;
  const maintenance = unitRows.filter((u) => u.status === "maintenance").length;
  const occupancy_pct = total_units > 0 ? Math.round((occupied / total_units) * 100) : 0;
  const active_leases = leases.filter((l) => l.status === "active" || l.status === "expiring").length;
  const monthly_revenue = leases
    .filter((l) => l.status === "active" || l.status === "expiring")
    .reduce((s, l) => s + Number(l.monthly_rent ?? 0), 0);

  return {
    property,
    units: unitRows,
    leases,
    activity: (activity ?? []) as any[],
    stats: {
      total_units,
      occupied,
      vacant,
      maintenance,
      occupancy_pct,
      monthly_revenue,
      active_leases,
    },
  };
}
