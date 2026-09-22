import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type UtilityType = "electricity" | "water" | "gas" | "other";

export type Meter = {
  id: string;
  unit_id: string;
  utility_type: UtilityType;
  meter_number: string | null;
  unit_label: string;
  initial_reading: number;
  active: boolean;
  created_at: string;
  // enriched
  unit_number?: string;
  property_id?: string;
  property_name?: string;
  last_reading?: number | null;
  last_reading_date?: string | null;
};

export type MeterReading = {
  id: string;
  meter_id: string;
  reading: number;
  reading_date: string;
  recorded_by: string | null;
  photo_url: string | null;
  notes: string | null;
  created_at: string;
};

export type UtilityRate = {
  id: string;
  property_id: string | null;
  utility_type: UtilityType;
  rate_per_unit: number;
  effective_from: string;
  effective_to: string | null;
  created_at: string;
};

// ---------------------------------------------------------------------------
// Meters
// ---------------------------------------------------------------------------

export async function listMeters(filter?: {
  utility_type?: UtilityType | "all";
  active?: boolean;
  q?: string;
  property_id?: string | "all";
}): Promise<Meter[]> {
  const supabase = await createClient();
  let q = supabase.schema("acct").from("meter").select("*").order("created_at", { ascending: false }).limit(1000);
  if (filter?.utility_type && filter.utility_type !== "all")
    q = q.eq("utility_type", filter.utility_type);
  if (filter?.active !== undefined) q = q.eq("active", filter.active);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  let rows = (data ?? []) as Meter[];

  // enrich with unit + property
  const unitIds = Array.from(new Set(rows.map((r) => r.unit_id).filter(Boolean)));
  if (unitIds.length > 0) {
    const { data: units } = await supabase
      .from("unit")
      .select("id, unit_number, property_id")
      .in("id", unitIds);
    const propertyIds = Array.from(
      new Set((units ?? []).map((u: any) => u.property_id).filter(Boolean))
    );
    const { data: props } =
      propertyIds.length > 0
        ? await supabase.from("property").select("id, name").in("id", propertyIds)
        : { data: [] as { id: string; name: string }[] };
    const uMap = new Map((units ?? []).map((u: any) => [u.id, u]));
    const pMap = new Map((props ?? []).map((p: any) => [p.id, p.name]));
    rows.forEach((m) => {
      const u: any = uMap.get(m.unit_id);
      if (u) {
        m.unit_number = u.unit_number;
        m.property_id = u.property_id;
        m.property_name = u.property_id ? pMap.get(u.property_id) : undefined;
      }
    });
  }

  // attach last reading
  if (rows.length > 0) {
    const meterIds = rows.map((r) => r.id);
    const { data: readings } = await supabase.schema("acct")
      .from("meter_reading")
      .select("meter_id, reading, reading_date")
      .in("meter_id", meterIds)
      .order("reading_date", { ascending: false });
    const lastByMeter = new Map<string, { reading: number; reading_date: string }>();
    for (const r of readings ?? []) {
      if (!lastByMeter.has((r as any).meter_id)) {
        lastByMeter.set((r as any).meter_id, {
          reading: Number((r as any).reading),
          reading_date: (r as any).reading_date,
        });
      }
    }
    rows.forEach((m) => {
      const last = lastByMeter.get(m.id);
      m.last_reading = last?.reading ?? null;
      m.last_reading_date = last?.reading_date ?? null;
    });
  }
  if (filter?.property_id && filter.property_id !== "all") {
    rows = rows.filter((m) => m.property_id === filter.property_id);
  }


  const needle = filter?.q?.trim().toLowerCase();
  if (needle) {
    rows = rows.filter(
      (m) =>
        (m.meter_number ?? "").toLowerCase().includes(needle) ||
        (m.unit_number ?? "").toLowerCase().includes(needle) ||
        (m.property_name ?? "").toLowerCase().includes(needle)
    );
  }

  return rows;
}

export async function getMeter(id: string): Promise<Meter | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.schema("acct").from("meter").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Meter) ?? null;
}

export async function createMeter(input: {
  unit_id: string;
  utility_type: UtilityType;
  meter_number?: string;
  unit_label?: string;
  initial_reading?: number;
}): Promise<Meter> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .schema("acct")
    .from("meter")
    .insert({
      unit_id: input.unit_id,
      utility_type: input.utility_type,
      meter_number: input.meter_number ?? null,
      unit_label: input.unit_label ?? "unit",
      initial_reading: input.initial_reading ?? 0,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as Meter;
}

// ---------------------------------------------------------------------------
// Readings
// ---------------------------------------------------------------------------

export async function listReadings(meter_id: string, limit = 24): Promise<MeterReading[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.schema("acct")
    .from("meter_reading")
    .select("*")
    .eq("meter_id", meter_id)
    .order("reading_date", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as MeterReading[];
}

export async function recordReading(input: {
  meter_id: string;
  reading: number;
  reading_date: string;
  recorded_by?: string | null;
  notes?: string;
}): Promise<MeterReading> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .schema("acct")
    .from("meter_reading")
    .upsert({
      meter_id: input.meter_id,
      reading: input.reading,
      reading_date: input.reading_date,
      recorded_by: input.recorded_by ?? null,
      notes: input.notes ?? null,
    }, { onConflict: "meter_id,reading_date" })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as MeterReading;
}

// ---------------------------------------------------------------------------
// Rates
// ---------------------------------------------------------------------------

export async function listRates(filter?: {
  property_id?: string;
  utility_type?: UtilityType;
}): Promise<UtilityRate[]> {
  const supabase = await createClient();
  let q = supabase.schema("acct").from("utility_rate").select("*").order("effective_from", { ascending: false });
  if (filter?.property_id) q = q.eq("property_id", filter.property_id);
  if (filter?.utility_type) q = q.eq("utility_type", filter.utility_type);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as UtilityRate[];
}

export function findEffectiveRate(
  rates: UtilityRate[],
  property_id: string | null,
  utility_type: UtilityType,
  on_date: string
): UtilityRate | null {
  const ts = new Date(on_date).getTime();
  return (
    rates
      .filter((r) => r.utility_type === utility_type)
      .filter((r) => r.property_id === property_id || r.property_id === null)
      .filter((r) => new Date(r.effective_from).getTime() <= ts)
      .filter((r) => !r.effective_to || new Date(r.effective_to).getTime() >= ts)
      .sort((a, b) => {
        // prefer property-specific over global
        if (a.property_id && !b.property_id) return -1;
        if (!a.property_id && b.property_id) return 1;
        // then most recent
        return new Date(b.effective_from).getTime() - new Date(a.effective_from).getTime();
      })[0] ?? null
  );
}

// ---------------------------------------------------------------------------
// Charges (preview before generating invoices)
// ---------------------------------------------------------------------------

export type ChargePreview = {
  meter_id: string;
  meter_number: string | null;
  utility_type: UtilityType;
  unit_id: string;
  unit_number: string | null;
  property_id: string | null;
  property_name: string | null;
  lease_id: string | null;
  previous_reading: number;
  current_reading: number;
  consumption: number;
  unit_label: string;
  rate_per_unit: number | null;
  amount: number;
  warning: string | null;
};

export async function computeCharges(billing_month: string): Promise<ChargePreview[]> {
  const supabase = await createClient();

  // Fetch all active meters
  const { data: meters } = await supabase.schema("acct")
    .from("meter")
    .select("*")
    .eq("active", true);
  if (!meters || meters.length === 0) return [];

  const meterIds = meters.map((m: any) => m.id);
  const unitIds = Array.from(new Set(meters.map((m: any) => m.unit_id)));

  // Fetch units + property info
  const { data: units } = await supabase
    .from("unit")
    .select("id, unit_number, property_id")
    .in("id", unitIds);
  const uMap = new Map((units ?? []).map((u: any) => [u.id, u]));
  const propertyIds = Array.from(new Set((units ?? []).map((u: any) => u.property_id).filter(Boolean)));
  const { data: props } =
    propertyIds.length > 0
      ? await supabase.from("property").select("id, name").in("id", propertyIds)
      : { data: [] as any[] };
  const pMap = new Map((props ?? []).map((p: any) => [p.id, p.name]));

  // Latest lease per unit
  const { data: leases } = await supabase
    .from("lease")
    .select("id, unit_id, status, end_date")
    .in("unit_id", unitIds)
    .eq("status", "active");
  const leaseByUnit = new Map<string, string>();
  for (const l of leases ?? []) leaseByUnit.set((l as any).unit_id, (l as any).id);

  // Fetch two readings per meter: current-month and previous
  const monthStart = billing_month + "-01";
  const { data: readings } = await supabase.schema("acct")
    .from("meter_reading")
    .select("meter_id, reading, reading_date")
    .in("meter_id", meterIds)
    .lte("reading_date", monthEnd(billing_month))
    .order("reading_date", { ascending: false });

  const readingsByMeter = new Map<string, { reading: number; reading_date: string }[]>();
  for (const r of readings ?? []) {
    const id = (r as any).meter_id;
    if (!readingsByMeter.has(id)) readingsByMeter.set(id, []);
    readingsByMeter.get(id)!.push({
      reading: Number((r as any).reading),
      reading_date: (r as any).reading_date,
    });
  }

  // Fetch rates
  const { data: rates } = await supabase.schema("acct").from("utility_rate").select("*");
  const allRates = (rates ?? []) as UtilityRate[];

  const result: ChargePreview[] = [];
  for (const m of meters as any[]) {
    const rs = readingsByMeter.get(m.id) ?? [];
    if (rs.length < 2) continue;

    const current = rs[0];
    const previous = rs[1];
    const consumption = Math.max(0, current.reading - previous.reading);

    const u = uMap.get(m.unit_id) as any;
    const property_id = u?.property_id ?? null;
    const rate = findEffectiveRate(allRates, property_id, m.utility_type, monthStart);

    const amount = rate ? consumption * rate.rate_per_unit : 0;
    const warning = !rate
      ? "No rate configured for " + m.utility_type + " on " + (pMap.get(property_id) ?? "this property") + " effective " + monthStart
      : current.reading < previous.reading
      ? "Reading went backwards since " + previous.reading_date
      : null;

    result.push({
      meter_id: m.id,
      meter_number: m.meter_number,
      utility_type: m.utility_type,
      unit_id: m.unit_id,
      unit_number: u?.unit_number ?? null,
      property_id,
      property_name: property_id ? pMap.get(property_id) ?? null : null,
      lease_id: leaseByUnit.get(m.unit_id) ?? null,
      previous_reading: previous.reading,
      current_reading: current.reading,
      consumption,
      unit_label: m.unit_label,
      rate_per_unit: rate ? rate.rate_per_unit : null,
      amount,
      warning,
    });
  }

  return result;
}

function monthEnd(month: string): string {
  const [y, mo] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, mo, 0));
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Generate utility invoices from a set of charges
// ---------------------------------------------------------------------------

export async function generateUtilityInvoices(
  charges: ChargePreview[],
  due_date: string
): Promise<{ created: number; skipped: number; errors: string[] }> {
  const admin = createAdminClient();
  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const c of charges) {
    if (!c.lease_id) { skipped++; continue; }
    if (c.amount <= 0) { skipped++; continue; }
    if (c.warning?.startsWith("No rate")) { skipped++; errors.push(c.warning); continue; }

    // Display number: UTIL-YYYY-####, generated from a per-year count
    const year = new Date(due_date).getFullYear();
    const { count } = await admin
      .schema("acct")
      .from("invoice")
      .select("id", { count: "exact", head: true })
      .eq("type", c.utility_type)
      .gte("created_at", year + "-01-01");
    const display = "UTIL-" + year + "-" + String((count ?? 0) + 1).padStart(4, "0");

    const { error } = await admin.schema("acct").from("invoice").insert({
      lease_id: c.lease_id,
      type: c.utility_type,
      amount: c.amount,
      due_date,
      status: "unpaid",
      display_number: display,
    });
    if (error) errors.push(c.meter_id + ": " + error.message);
    else created++;
  }

  return { created, skipped, errors };
}
