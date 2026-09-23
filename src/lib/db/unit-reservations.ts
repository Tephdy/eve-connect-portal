import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type UnitReservation = {
  id: string;
  unit_id: string;
  client_name: string;
  client_phone: string | null;
  client_email: string | null;
  reservation_fee: number | null;
  payment_mode: "cash" | "gcash" | "bank" | "check" | "other" | null;
  reference_number: string | null;
  reserved_at: string;
  reserved_by: string | null;
  released_at: string | null;
  released_by: string | null;
  release_reason: string | null;
  inquiry_id: string | null;
  verification_status: "pending" | "verified" | "discrepancy";
  verified_at: string | null;
  verified_by: string | null;
  or_reference: string | null;
  verification_notes: string | null;
  intent: string | null;
  term: string | null;
  lease_start_date: string | null;
  lease_end_date: string | null;
  move_in_date: string | null;
  rent_due_date: string | null;
  monthly_rent: number | null;
  deposit_1: number | null;
  deposit_2: number | null;
  deposit_1_due_date: string | null;
  deposit_2_due_date: string | null;
  add_ons: { label: string; amount: number }[] | null;
  add_ons_amount: number | null;
  notice_period_days: number | null;
  lease_status: "draft" | "active";
};

const SELECT =
  "id, unit_id, client_name, client_phone, client_email, reservation_fee, payment_mode, reference_number, reserved_at, reserved_by, released_at, released_by, release_reason, inquiry_id, verification_status, verified_at, verified_by, or_reference, verification_notes, intent, term, lease_start_date, lease_end_date, move_in_date, rent_due_date, monthly_rent, deposit_1, deposit_2, deposit_1_due_date, deposit_2_due_date, add_ons, add_ons_amount, notice_period_days, lease_status";

/**
 * The currently open reservation for a unit (released_at IS NULL), if any.
 */
export async function getOpenReservation(unit_id: string): Promise<UnitReservation | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("acct")
    .from("unit_reservation")
    .select(SELECT)
    .eq("unit_id", unit_id)
    .is("released_at", null)
    .order("reserved_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as UnitReservation) ?? null;
}

export async function listOpenReservations(): Promise<UnitReservation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("acct")
    .from("unit_reservation")
    .select(SELECT)
    .is("released_at", null)
    .order("reserved_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as UnitReservation[];
}

export async function createReservation(input: {
  unit_id: string;
  client_name: string;
  client_phone?: string | null;
  client_email?: string | null;
  reservation_fee?: number | null;
  payment_mode?: "cash" | "gcash" | "bank" | "check" | "other" | null;
  reference_number?: string | null;
  reserved_by: string | null;
  inquiry_id?: string | null;
  intent?: string | null;
  term?: string | null;
  lease_start_date?: string | null;
  lease_end_date?: string | null;
  move_in_date?: string | null;
  rent_due_date?: string | null;
  monthly_rent?: number | null;
  deposit_1?: number | null;
  deposit_2?: number | null;
  deposit_1_due_date?: string | null;
  deposit_2_due_date?: string | null;
  add_ons?: { label: string; amount: number }[] | null;
  add_ons_amount?: number | null;
  notice_period_days?: number | null;
  lease_status?: "draft" | "active";
}): Promise<UnitReservation> {
  const admin = createAdminClient();

  // Ensure no other open reservation for this unit
  const { data: existing } = await admin
    .schema("acct")
    .from("unit_reservation")
    .select("id")
    .eq("unit_id", input.unit_id)
    .is("released_at", null)
    .maybeSingle();
  if (existing) {
    throw new Error("Unit already has an open reservation");
  }

  const { data, error } = await admin
    .schema("acct")
    .from("unit_reservation")
    .insert({
      unit_id: input.unit_id,
      client_name: input.client_name,
      client_phone: input.client_phone ?? null,
      client_email: input.client_email ?? null,
      reservation_fee: input.reservation_fee ?? null,
      payment_mode: input.payment_mode ?? null,
      reference_number: input.reference_number ?? null,
      reserved_by: input.reserved_by,
      inquiry_id: input.inquiry_id ?? null,
      intent: input.intent ?? null,
      term: input.term ?? null,
      lease_start_date: input.lease_start_date ?? null,
      lease_end_date: input.lease_end_date ?? null,
      move_in_date: input.move_in_date ?? null,
      rent_due_date: input.rent_due_date ?? null,
      monthly_rent: input.monthly_rent ?? null,
      deposit_1: input.deposit_1 ?? null,
      deposit_2: input.deposit_2 ?? null,
      deposit_1_due_date: input.deposit_1_due_date ?? null,
      deposit_2_due_date: input.deposit_2_due_date ?? null,
      add_ons: input.add_ons ?? [],
      add_ons_amount: input.add_ons_amount ?? 0,
      notice_period_days: input.notice_period_days ?? null,
      lease_status: input.lease_status ?? "draft",
    })
    .select(SELECT)
    .single();
  if (error) throw new Error(error.message);

  // Flip unit status
  await admin.from("unit").update({ status: "reserved" }).eq("id", input.unit_id);

  return data as UnitReservation;
}

export async function releaseReservation(input: {
  unit_id: string;
  released_by: string | null;
  reason?: string | null;
  /** Optional: set unit back to this status. Defaults to "vacant". */
  new_status?: "vacant" | "unavailable" | "occupied";
}): Promise<void> {
  const admin = createAdminClient();

  const { data: open, error: readErr } = await admin
    .schema("acct")
    .from("unit_reservation")
    .select("id")
    .eq("unit_id", input.unit_id)
    .is("released_at", null)
    .order("reserved_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (readErr) throw new Error(readErr.message);
  if (!open) throw new Error("No open reservation found");

  const { error: updateErr } = await admin
    .schema("acct")
    .from("unit_reservation")
    .update({
      released_at: new Date().toISOString(),
      released_by: input.released_by,
      release_reason: input.reason ?? null,
    })
    .eq("id", open.id);
  if (updateErr) throw new Error(updateErr.message);

  await admin
    .from("unit")
    .update({ status: input.new_status ?? "vacant" })
    .eq("id", input.unit_id);
}


// ---------------------------------------------------------------------------
// Accounting list with filters + enrichment
// ---------------------------------------------------------------------------

export type ReservationRow = UnitReservation & {
  unit_number?: string;
  property_id?: string;
  property_name?: string;
  /** From the linked inquiry (if reservation came from one). */
  inquiry_messenger_name?: string | null;
  inquiry_government_id?: string | null;
};

export async function listReservations(filter?: {
  open_only?: boolean;
  property_id?: string | "all";
}): Promise<ReservationRow[]> {
  const supabase = await createClient();
  const openOnly = filter?.open_only ?? true;

  let q = supabase
    .schema("acct")
    .from("unit_reservation")
    .select(SELECT)
    .order("reserved_at", { ascending: false })
    .limit(1000);

  if (openOnly) q = q.is("released_at", null);

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as ReservationRow[];
  if (rows.length === 0) return rows;

  const unitIds = Array.from(new Set(rows.map((r) => r.unit_id))).filter(Boolean);
  const { data: units } = await supabase
    .from("unit")
    .select("id, unit_number, property_id")
    .in("id", unitIds);
  const uMap = new Map((units ?? []).map((u: any) => [u.id, u]));

  const propIds = Array.from(
    new Set((units ?? []).map((u: any) => u.property_id).filter(Boolean))
  );
  const { data: props } =
    propIds.length > 0
      ? await supabase.from("property").select("id, name").in("id", propIds)
      : { data: [] as { id: string; name: string }[] };
  const pMap = new Map((props ?? []).map((p: any) => [p.id, p.name]));

  rows.forEach((r) => {
    const u: any = uMap.get(r.unit_id);
    if (u) {
      r.unit_number = u.unit_number;
      r.property_id = u.property_id;
      r.property_name = u.property_id ? pMap.get(u.property_id) : undefined;
    }
  });

  // Enrich with linked inquiry details (messenger_name, government_id)
  const inquiryIds = Array.from(
    new Set(rows.map((r) => r.inquiry_id).filter(Boolean))
  ) as string[];
  if (inquiryIds.length > 0) {
    const { data: inquiries } = await supabase
      .from("inquiry")
      .select("id, messenger_name, government_id")
      .in("id", inquiryIds);
    const iMap = new Map(
      (inquiries ?? []).map((i: any) => [i.id, i])
    );
    rows.forEach((r) => {
      if (!r.inquiry_id) return;
      const inq: any = iMap.get(r.inquiry_id);
      if (inq) {
        r.inquiry_messenger_name = inq.messenger_name ?? null;
        r.inquiry_government_id = inq.government_id ?? null;
      }
    });
  }

  if (filter?.property_id && filter.property_id !== "all") {
    return rows.filter((r) => r.property_id === filter.property_id);
  }
  return rows;
}


// ---------------------------------------------------------------------------
// Verification (Stage 4)
// ---------------------------------------------------------------------------

export async function getReservation(id: string): Promise<UnitReservation | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("acct")
    .from("unit_reservation")
    .select(SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as UnitReservation) ?? null;
}

export async function verifyReservation(input: {
  id: string;
  status: "pending" | "verified" | "discrepancy";
  or_reference?: string | null;
  notes?: string | null;
  verified_by: string | null;
}): Promise<UnitReservation> {
  const admin = createAdminClient();
  const patch: Record<string, unknown> = {
    verification_status: input.status,
    verified_by: input.verified_by,
    verified_at: input.status === "pending" ? null : new Date().toISOString(),
  };
  if (input.or_reference !== undefined) patch.or_reference = input.or_reference;
  if (input.notes !== undefined) patch.verification_notes = input.notes;

  const { data, error } = await admin
    .schema("acct")
    .from("unit_reservation")
    .update(patch)
    .eq("id", input.id)
    .select(SELECT)
    .single();
  if (error) throw new Error(error.message);
  return data as UnitReservation;
}


// ---------------------------------------------------------------------------
// Lease linkage (Stage 5)
// ---------------------------------------------------------------------------

/**
 * Mark a reservation as having produced a lease: flip lease_status to "active"
 * and record who/when. Idempotent.
 */
export async function markReservationLeased(input: {
  reservation_id: string;
  actor_id: string | null;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .schema("acct")
    .from("unit_reservation")
    .update({
      lease_status: "active",
    })
    .eq("id", input.reservation_id);
  if (error) throw new Error(error.message);
}
