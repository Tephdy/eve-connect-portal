// @@CONTRACT_ENGINE:build-context
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  BuildContractContextInput,
  ContractContext,
  PlaceholderKey,
} from "./types";

const PHP = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatPhp(amount: number | null | undefined): string {
  return PHP.format(Number(amount) || 0);
}

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

export function formatDate(input: string | Date | null | undefined): string {
  if (!input) return "";
  const d = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return "";
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function s(v: unknown): string {
  return v == null ? "" : String(v);
}

export async function buildContractContext(
  input: BuildContractContextInput
): Promise<ContractContext> {
  const admin = createAdminClient();

  const { data: lease, error: leaseErr } = await admin
    .schema("core")
    .from("lease")
    .select(
      "id, tenant_id, unit_id, start_date, end_date, move_in_date, " +
      "monthly_rent, occupancy_fee, utility_deposit, " +
      "advance_amount, advance_due_date, " +
      "deposit_amount, deposit_1, deposit_2, " +
      "deposit_1_due_date, deposit_2_due_date, " +
      "due_date, due_day, control_number, barcode_value, " +
      "reservation_fee, reservation_fee_nonrefundable_on, " +
      "deposit_nonrefundable_on, target_move_in_date, reservation_total_due, " +
      "term, term_label, term_months"
    )
    .eq("id", input.leaseId)
    .single();

  if (leaseErr || !lease) {
    throw new Error(
      "buildContractContext: lease not found — " +
        (leaseErr?.message ?? input.leaseId)
    );
  }

  const { data: tenant, error: tenantErr } = await admin
    .schema("core")
    .from("tenant")
    .select("*")
    .eq("id", lease.tenant_id)
    .single();

  if (tenantErr || !tenant) {
    throw new Error(
      "buildContractContext: tenant not found — " +
        (tenantErr?.message ?? lease.tenant_id)
    );
  }

  const { data: unit, error: unitErr } = await admin
    .schema("core")
    .from("unit")
    .select("id, unit_number, property_id")
    .eq("id", lease.unit_id)
    .single();

  if (unitErr || !unit) {
    throw new Error(
      "buildContractContext: unit not found — " +
        (unitErr?.message ?? lease.unit_id)
    );
  }

  const { data: property } = await admin
    .schema("core")
    .from("property")
    .select("id, name, address")
    .eq("id", unit.property_id)
    .single();

  const { data: inspection } = await admin
    .schema("prep")
    .from("unit_inspection")
    .select("*")
    .eq("lease_id", input.leaseId)
    .maybeSingle();

  const today = new Date();
  const rentalEnd = new Date(lease.end_date);
  const day20 = addDays(rentalEnd, -20);

  const dueDay =
    lease.due_day ??
    (lease.due_date ? new Date(lease.due_date).getDate() : null);
  const dueDateStr = dueDay ? `${ordinal(dueDay)} of every month` : "";

  const totalDue =
    (Number(lease.advance_amount) || 0) +
    (Number(lease.deposit_1) || 0) +
    (Number(lease.deposit_2) || 0) +
    (Number(lease.utility_deposit) || 0);

  // @@CONTRACT_ENGINE:control-source
  // Control number is persisted on the lease at creation time (see attach.ts).
  // Fall back to deterministic-from-id so previews never render blank.
  const controlNumber =
    lease.control_number ??
    `DRAFT-${lease.id.slice(0, 8).toUpperCase()}`;
  const barcodeValue =
    lease.barcode_value ?? controlNumber.replace(/\s+/g, "").toUpperCase();

  const ctx: ContractContext = {
    legal_name: s(tenant.full_name),
    first_name: s(tenant.first_name),
    middle_name: s(tenant.middle_name),
    last_name: s(tenant.last_name),
    age: s(tenant.age),
    gender: s(tenant.gender),
    nationality: s(tenant.nationality),
    religion: s(tenant.religion),
    civil_status: s(tenant.civil_status),
    perm_address: s(tenant.permanent_address),
    rec_address: s(tenant.recent_address),
    mobile_num: s(tenant.phone),
    email_addr: s(tenant.email),
    company: s(tenant.company),
    status: s(tenant.work_status),
    position: s(tenant.work_position),
    comp_addr: s(tenant.company_address),
    comp_tel: s(tenant.company_tel),
    comp_email: s(tenant.company_email),
    comp_msgr: s(tenant.company_messenger),
    marketing_src: s(tenant.marketing_source),
    ec1_name: s(tenant.ec1_name),
    ec1_tel: s(tenant.ec1_phone),
    ec1_email: s(tenant.ec1_email),
    ec1_mssgr: s(tenant.ec1_messenger),
    ec2_name: s(tenant.ec2_name),
    ec2_tel: s(tenant.ec2_phone),
    ec2_email: s(tenant.ec2_email),
    ec2_mssgr: s(tenant.ec2_messenger),

    rate: formatPhp(lease.monthly_rent),
    occupancy_fee: formatPhp(lease.occupancy_fee),
    utility_dep: formatPhp(lease.utility_deposit),
    sec_dep: formatPhp(lease.deposit_amount),
    advance_amount: formatPhp(lease.advance_amount),
    advance_due_date: formatDate(lease.advance_due_date),
    deposit_1: formatPhp(lease.deposit_1),
    deposit_2: formatPhp(lease.deposit_2),
    deposit_1_due_date: formatDate(lease.deposit_1_due_date),
    deposit_2_due_date: formatDate(lease.deposit_2_due_date),
    due_date: dueDateStr,
    due_day: lease.due_day ?? null,
    rental_start: formatDate(lease.start_date),
    rental_end: formatDate(lease.end_date),
    move_in_date: formatDate(lease.move_in_date),
    control_number: controlNumber,
    barcode: barcodeValue,
    term_months: lease.term_months != null ? String(lease.term_months) : "6",

    unit_no: s(unit.unit_number),
    unit_num: s(unit.unit_number),
    property_name: s(property?.name),
    property_address: s(property?.address),

    reservation_fee: formatPhp(lease.reservation_fee),
    reserv_nonrefundable_on: formatDate(lease.reservation_fee_nonrefundable_on),
    deposit_nonrefund_on: formatDate(lease.deposit_nonrefundable_on),
    target_move_in: formatDate(lease.target_move_in_date),
    total: formatPhp(totalDue),

    switches: s(inspection?.switches),
    switches_com: s(inspection?.switches_comment),
    sockets: s(inspection?.sockets),
    sockets_com: s(inspection?.sockets_comment),
    cabinet: s(inspection?.cabinet),
    cabinet_com: s(inspection?.cabinet_comment),
    lavatory: s(inspection?.lavatory),
    lavatory_com: s(inspection?.lavatory_comment),
    light_bulb: s(inspection?.light_bulb),
    light_bulb_com: s(inspection?.light_bulb_comment),
    faucets: s(inspection?.faucets),
    faucets_com: s(inspection?.faucets_comment),
    shower_head: s(inspection?.shower_head),
    shower_head_com: s(inspection?.shower_head_comment),
    declogging: s(inspection?.declogging),
    declogging_com: s(inspection?.declogging_comment),
    toilet_bowl: s(inspection?.toilet_bowl),
    toilet_bowl_com: s(inspection?.toilet_bowl_comment),
    kitchen_sink: s(inspection?.kitchen_sink),
    kitchen_sink_com: s(inspection?.kitchen_sink_comment),
    wall_paint: s(inspection?.wall_paint),
    wall_paint_com: s(inspection?.wall_paint_comment),
    optional: s(inspection?.optional_items),
    optional_com: s(inspection?.optional_items_comment),
    doors: s(inspection?.door),
    doors_com: s(inspection?.door_comment),
    num_per: s(inspection?.number_of_persons),
    water: s(inspection?.water_initial),
    electric: s(inspection?.electric_initial),
    water_initial: s(inspection?.water_initial),
    electric_initial: s(inspection?.electric_initial),

    current_date: formatDate(today),
    date: formatDate(today),
    day20: formatDate(day20),
    rep: s(input.repName),
  };

  return ctx;
}

export function isPlaceholderKey(k: string): k is PlaceholderKey {
  return k.length > 0 && /^[a-z0-9_]+$/.test(k);
}
