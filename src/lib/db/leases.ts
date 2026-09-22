import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { LeaseCreateInput, LeaseUpdateInput } from "@/lib/schemas/lease";

export type Lease = {
  id: string;
  unit_id: string;
  tenant_id: string;
  start_date: string;
  end_date: string;
  move_in_date: string | null;
  due_date: string | null;
  intent: "new" | "renew" | "extend" | null;
  term: string | null;
  monthly_rent: number;
  deposit_amount: number;
  deposit_1: number | null;
  deposit_2: number | null;
  ad_ons: unknown;
  ad_ons_amount: number | null;
  notice_period_days: number;
  status: "draft" | "active" | "expiring" | "ended" | "terminated";
  created_at: string;
  unit_number?: string;
  tenant_name?: string;
  property_id?: string;
  property_name?: string;
};

// Must be a SINGLE literal string so Supabase can infer row shape.
const LEASE_SELECT =
  "id, unit_id, tenant_id, start_date, end_date, monthly_rent, deposit_amount, notice_period_days, status, created_at, due_date, deposit_1, deposit_2, move_in_date, intent, ad_ons, ad_ons_amount, term, unit_number, tenant_name";

// Writes go to core.lease (base table) — this select is only used for
// the returned row after insert/update, so it can exclude joined columns.
const LEASE_WRITE_SELECT =
  "id, unit_id, tenant_id, start_date, end_date, monthly_rent, deposit_amount, notice_period_days, status, created_at, due_date, deposit_1, deposit_2, move_in_date, intent, ad_ons, ad_ons_amount, term";

function parseAdOns(raw: string | undefined | null): unknown[] {
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean).map((text) => ({ text }));
}

function logWriteError(fn: string, error: any) {
  console.error("[" + fn + "]", JSON.stringify(error, null, 2));
}

export async function createLease(input: LeaseCreateInput): Promise<Lease> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .schema("core")
    .from("lease")
    .insert({
      unit_id: input.unit_id,
      tenant_id: input.tenant_id,
      start_date: input.start_date,
      end_date: input.end_date,
      move_in_date: input.move_in_date || null,
      due_date: input.due_date || null,
      intent: input.intent ?? "new",
      term: input.term ?? null,
      monthly_rent: input.monthly_rent,
      deposit_amount: input.deposit_amount ?? 0,
      deposit_1: input.deposit_1 ?? 0,
      deposit_2: input.deposit_2 ?? 0,
      notice_period_days: input.notice_period_days,
      ad_ons: parseAdOns(typeof input.ad_ons === "string" ? input.ad_ons : ""),
      ad_ons_amount: input.ad_ons_amount ?? 0,
      status: input.status,
    })
    .select(LEASE_WRITE_SELECT)
    .single();

  if (error) {
    logWriteError("createLease", error);
    throw new Error(error.message);
  }
  return data as unknown as Lease;
}

export async function updateLease(id: string, input: LeaseUpdateInput): Promise<Lease> {
  const admin = createAdminClient();
  const patch: Record<string, unknown> = {};

  if (input.unit_id !== undefined) patch.unit_id = input.unit_id;
  if (input.tenant_id !== undefined) patch.tenant_id = input.tenant_id;
  if (input.start_date !== undefined) patch.start_date = input.start_date;
  if (input.end_date !== undefined) patch.end_date = input.end_date;
  if (input.move_in_date !== undefined) patch.move_in_date = input.move_in_date || null;
  if (input.due_date !== undefined) patch.due_date = input.due_date || null;
  if (input.intent !== undefined) patch.intent = input.intent;
  if (input.term !== undefined) patch.term = input.term;
  if (input.monthly_rent !== undefined) patch.monthly_rent = input.monthly_rent;
  if (input.deposit_amount !== undefined) patch.deposit_amount = input.deposit_amount;
  if (input.deposit_1 !== undefined) patch.deposit_1 = input.deposit_1;
  if (input.deposit_2 !== undefined) patch.deposit_2 = input.deposit_2;
  if (input.notice_period_days !== undefined) patch.notice_period_days = input.notice_period_days;
  if (input.ad_ons !== undefined) {
    patch.ad_ons = parseAdOns(typeof input.ad_ons === "string" ? input.ad_ons : "");
  }
  if (input.ad_ons_amount !== undefined) patch.ad_ons_amount = input.ad_ons_amount;
  if (input.status !== undefined) patch.status = input.status;

  const { data, error } = await admin
    .schema("core")
    .from("lease")
    .update(patch)
    .eq("id", id)
    .select(LEASE_WRITE_SELECT)
    .single();

  if (error) {
    logWriteError("updateLease", error);
    throw new Error(error.message);
  }
  return data as unknown as Lease;
}

export async function terminateLease(id: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .schema("core")
    .from("lease")
    .update({ status: "terminated" })
    .eq("id", id);
  if (error) {
    logWriteError("terminateLease", error);
    throw new Error(error.message);
  }
}
export type LeaseFilter = {
  status?: "all" | "draft" | "active" | "expiring" | "ended" | "terminated";
  term?: string | "all";
  property_id?: string | "all";
  q?: string;
  ends_before?: string;
};

export async function listLeases(
  filter: LeaseFilter = {}
): Promise<Lease[]> {
  const supabase = await createClient();

  let q = supabase
    .from("lease")
    .select(LEASE_SELECT)
    .order("created_at", { ascending: false })
    .limit(1000);

  if (filter.status && filter.status !== "all") q = q.eq("status", filter.status);
  if (filter.term && filter.term !== "all") q = q.eq("term", filter.term);

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  let rows = (data ?? []) as unknown as Lease[];

  // Property enrichment + filter (cross-schema safe: fetch, filter in JS)
  const unitIds = Array.from(new Set(rows.map((r) => r.unit_id).filter(Boolean)));
  if (unitIds.length > 0) {
    const { data: units } = await supabase
      .from("unit")
      .select("id, property_id")
      .in("id", unitIds);

    const propertyIds = Array.from(
      new Set((units ?? []).map((u: any) => u.property_id).filter(Boolean))
    );
    const { data: properties } =
      propertyIds.length > 0
        ? await supabase.from("property").select("id, name").in("id", propertyIds)
        : { data: [] as { id: string; name: string }[] };

    const unitPropMap = new Map((units ?? []).map((u: any) => [u.id, u.property_id]));
    const pMap = new Map((properties ?? []).map((p: any) => [p.id, p.name]));

    rows.forEach((r) => {
      const propId = unitPropMap.get(r.unit_id) ?? null;
      if (propId) {
        r.property_id = propId as string;
        r.property_name = pMap.get(propId as string) as string | undefined;
      }
    });
  }

  if (filter.property_id && filter.property_id !== "all") {
    rows = rows.filter((r) => r.property_id === filter.property_id);
  }

  const needle = filter.q?.trim().toLowerCase();
  if (needle) {
    rows = rows.filter(
      (r) =>
        (r.unit_number ?? "").toLowerCase().includes(needle) ||
        (r.tenant_name ?? "").toLowerCase().includes(needle) ||
        r.id.toLowerCase().includes(needle)
    );
  }

  if (filter.ends_before) {
    const ts = new Date(filter.ends_before).getTime();
    rows = rows.filter((r) => new Date(r.end_date).getTime() <= ts);
  }

  return rows;
}

export async function getLease(id: string): Promise<Lease | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lease")
    .select(LEASE_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as unknown as Lease) ?? null;
}