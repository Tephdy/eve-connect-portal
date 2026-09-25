import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type Forecast = {
  id: string;
  unit_id: string;
  earliest_available_date: string;
  confidence: "confirmed" | "estimated";
  notes: string | null;
  computed_at: string;
  unit_number?: string;
  property_name?: string;
};

async function enrich(rows: Forecast[]): Promise<Forecast[]> {
  if (rows.length === 0) return rows;
  const supabase = await createClient();
  const unitIds = Array.from(new Set(rows.map((r) => r.unit_id)));
  const { data: units } = await supabase
    .from("unit").select("id, unit_number, property_id").in("id", unitIds);

  const propIds = Array.from(new Set((units ?? []).map((u: any) => u.property_id)));
  const { data: props } = propIds.length > 0
    ? await supabase.from("property").select("id, name").in("id", propIds)
    : { data: [] as { id: string; name: string }[] };

  const uMap = new Map((units ?? []).map((u: any) => [u.id, u]));
  const pMap = new Map((props ?? []).map((p) => [p.id, p.name]));

  rows.forEach((r) => {
    const u = uMap.get(r.unit_id) as any;
    r.unit_number = u?.unit_number;
    r.property_name = u ? pMap.get(u.property_id) : undefined;
  });
  return rows;
}

export async function listForecasts(): Promise<Forecast[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("availability_forecast")
    .select("id, unit_id, earliest_available_date, confidence, notes, computed_at")
    .order("earliest_available_date", { ascending: true });
  if (error) throw new Error(error.message);
  return enrich((data ?? []) as Forecast[]);
}

export async function upsertForecast(input: {
  unit_id: string;
  earliest_available_date: string;
  confidence: "confirmed" | "estimated";
  notes: string | null;
}): Promise<Forecast> {
  const admin = createAdminClient();
  // Upsert: one forecast per unit (latest)
  const { data: existing } = await admin
    .from("availability_forecast").select("id").eq("unit_id", input.unit_id).maybeSingle();

  if (existing) {
    const { data, error } = await admin
      .from("availability_forecast")
      .update({
        earliest_available_date: input.earliest_available_date,
        confidence: input.confidence,
        notes: input.notes,
        computed_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("id, unit_id, earliest_available_date, confidence, notes, computed_at")
      .single();
    if (error) throw new Error(error.message);
    return data as Forecast;
  }

  const { data, error } = await admin
    .from("availability_forecast")
    .insert({
      unit_id: input.unit_id,
      earliest_available_date: input.earliest_available_date,
      confidence: input.confidence,
      notes: input.notes,
    })
    .select("id, unit_id, earliest_available_date, confidence, notes, computed_at")
    .single();
  if (error) throw new Error(error.message);
  return data as Forecast;
}

/**
 * Deterministic forecast:
 * For each unit, compute earliest_available_date based on:
 *  - vacant units: today
 *  - occupied units: lease.end_date + notice_period_days
 *  - maintenance: today + 7 days buffer
 */
export async function recalculateForecasts(): Promise<number> {
  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: units } = await admin
    .from("unit")
    .select("id, status");

  if (!units) return 0;

  let count = 0;

  for (const unit of units) {
    let date = today;
    let confidence: "confirmed" | "estimated" = "confirmed";

    if (unit.status === "occupied") {
      const { data: lease } = await admin
        .from("lease")
        .select("end_date, notice_period_days, status")
        .eq("unit_id", unit.id)
        .in("status", ["active", "expiring"])
        .order("end_date", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (lease) {
        const end = new Date(lease.end_date);
        const bufferDays = Number(lease.notice_period_days ?? 0);
        end.setDate(end.getDate() + bufferDays);
        date = end.toISOString().slice(0, 10);
        confidence = "estimated";
      }
    } else if (unit.status === "maintenance") {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      date = d.toISOString().slice(0, 10);
      confidence = "estimated";
    }

    await upsertForecast({
      unit_id: unit.id,
      earliest_available_date: date,
      confidence,
      notes: null,
    });
    count++;
  }
  return count;
}
