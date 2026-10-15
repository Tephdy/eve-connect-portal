// @@CONTRACT_ENGINE:reservation-context
import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ReservationContext } from "./reservation-types";

// @@CONTRACT_ENGINE:rep-signature-context
const SIGNATURE_CACHE = new Map<string, string>();

async function getSignatureDataUri(filename: string): Promise<string> {
  const hit = SIGNATURE_CACHE.get(filename);
  if (hit) return hit;
  try {
    const buf = await readFile(join(process.cwd(), "public", filename));
    const uri = "data:image/png;base64," + buf.toString("base64");
    SIGNATURE_CACHE.set(filename, uri);
    return uri;
  } catch {
    return "";
  }
}

const PHP_PLAIN = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function fmt(n: number | null | undefined): string {
  return PHP_PLAIN.format(Number(n) || 0);
}

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function fmtDate(input: string | Date | null | undefined): string {
  if (!input) return "";
  const d = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return "";
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function s(v: unknown): string {
  return v == null ? "" : String(v);
}

function daysBetween(a: Date, b: Date): number {
  const ms = Math.abs(b.getTime() - a.getTime());
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export async function buildReservationContext(
  reservationId: string
): Promise<ReservationContext> {
  const admin = createAdminClient();

  const { data: r, error } = await admin
    .schema("acct")
    .from("unit_reservation")
    .select("*")
    .eq("id", reservationId)
    .single();

  if (error || !r) {
    throw new Error(
      "buildReservationContext: reservation not found — " +
        (error?.message ?? reservationId)
    );
  }

  // Resolve unit + property
  const { data: unit } = await admin
    .schema("core")
    .from("unit")
    .select("id, unit_number, bedrooms, property_id")
    .eq("id", r.unit_id)
    .maybeSingle();

  let propertyName = "";
  if (unit?.property_id) {
    const { data: prop } = await admin
      .schema("core")
      .from("property")
      .select("name")
      .eq("id", unit.property_id)
      .maybeSingle();
    propertyName = s(prop?.name);
  }

  // Optional tenant link (if the reservation created a tenant)
  const { data: tenant } = await admin
    .schema("core")
    .from("tenant")
    .select("id, full_name, age, gender, company, work_position, email, phone, messenger_name")
    .ilike("full_name", r.client_name)
    .maybeSingle();

  // ---- Derived values ----
  const monthlyRent = Number(r.monthly_rent) || 0;
  const reservationFee = Number(r.reservation_fee) || 0;
  const deposit1 = Number(r.deposit_1) || 0;
  const deposit2 = Number(r.deposit_2) || 0;
  const totalDep = deposit1 + deposit2;
  const advancePaid = Number(r.monthly_rent) || 0; // for now, treat advance as 1 month rent
  const totalAdvance = monthlyRent; // 1 month advance
  const remainingAdvance = Math.max(0, totalAdvance - reservationFee);

  const addOnsArr = Array.isArray(r.add_ons) ? r.add_ons : [];
  const addOnsText = addOnsArr
    .map((a: { label?: string; amount?: number }) =>
      a?.label ? `${a.label}: P${fmt(a.amount ?? 0)}` : null
    )
    .filter(Boolean)
    .join("; ");
  const addOnsAmount = addOnsArr.reduce(
    (sum: number, a: { amount?: number }) => sum + (Number(a?.amount) || 0),
    0
  );

  const noticeDays = Number(r.notice_period_days) || 30;

  const targetMoveIn = r.move_in_date ? new Date(r.move_in_date) : null;
  const daysToMoveIn = targetMoveIn
    ? daysBetween(new Date(), targetMoveIn)
    : noticeDays;

  const occupancySupportFee = 298;
  const totalPayable =
    totalAdvance + totalDep + addOnsAmount + occupancySupportFee;
  const amountPaid = reservationFee;
  const remainingBalance = Math.max(0, totalPayable - amountPaid);
  const moveInPayable = remainingBalance;

  // // @@CONTRACT_ENGINE:promissory-context
  // Option A allocation:
  //   reservation fee applies first to the 1-month advance,
  //   then the remainder to the 1st security deposit.
  const appliedToAdvance = Math.min(reservationFee, totalAdvance);
  const appliedToDeposit1 = Math.max(0, reservationFee - totalAdvance);
  const remainingDeposit1 = Math.max(0, deposit1 - appliedToDeposit1);

  // @@CONTRACT_ENGINE:rep-signature-context
  // @@CONTRACT_ENGINE:reservation-context-url-images
  // Use a URL reference (not data URI) so the printed body stays small
  // and page pagination works. The browser fetches the file at print time.
  const representative_signature =
    '<img class="rep-signature" src="/jorgette%20sign.png" alt="Property Representative signature" />';

  return {
    legal_name: s(r.client_name),
    age: s(tenant?.age),
    gender: s(r.gender) || s(tenant?.gender),
    company_name: s(r.company) || s(tenant?.company),
    messenger_account: s((r as { client_messenger?: string }).client_messenger),
    position: s(r.position) || s(tenant?.work_position),
    vehicle_plate: s(r.vehicle_plate),
    valid_id: r.valid_id_path ? "Uploaded" : "",
    declared_occupants: String(r.declared_occupants ?? 1),
    contact_no: s(r.client_phone),
    target_move_in_date: fmtDate(r.move_in_date),
    email: s(r.client_email),

    unit_type: s(unit?.unit_number) + (unit?.bedrooms ? ` (${unit.bedrooms}BR)` : ""),
    property: propertyName,
    advance_paid: fmt(advancePaid),
    total_dep: fmt(totalDep),
    total_rental: fmt(monthlyRent),
    reservation_fee: fmt(reservationFee),
    add_ons: addOnsText,
    ac_amount: fmt(0),
    bf_amount: fmt(0),
    foam_amount: fmt(0),
    others_amount: fmt(0),
    add_ons_amount: fmt(addOnsAmount),
    admin_fee: fmt(0),
    occupancy_fee: fmt(occupancySupportFee),
    total_payable: fmt(totalPayable),
    amount_paid: fmt(amountPaid),
    remaining_balance: fmt(remainingBalance),

    total_advance: fmt(totalAdvance),
    remaining_advance: fmt(remainingAdvance),
    move_in_payable: fmt(moveInPayable),
    first_deposit: fmt(deposit1),
    second_deposit: fmt(deposit2),

    one_month_advance_date: fmtDate(r.move_in_date),
    first_security_date: fmtDate(r.deposit_1_due_date),
    second_security_date: fmtDate(r.deposit_2_due_date),
    reservation_no_refund: fmtDate(r.reserved_at),
    first_sec_no_refund: fmtDate(r.deposit_1_due_date),

    days_to_move_in: String(daysToMoveIn),
    representative: "Authorized Representative",
    representative_signature,

    // // @@CONTRACT_ENGINE:promissory-context
    reservation_fee_applied_to_advance: fmt(appliedToAdvance),
    reservation_fee_applied_to_deposit_1: fmt(appliedToDeposit1),
    remaining_deposit_1: fmt(remainingDeposit1),
  };
}
