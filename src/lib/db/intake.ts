import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { IntakeInput } from "@/lib/schemas/intake";

function toNull(v: string | undefined | null): string | null {
  if (v == null) return null;
  const t = String(v).trim();
  return t.length === 0 ? null : t;
}

// ---------------------------------------------------------------------------
// Add-ons parser
// ---------------------------------------------------------------------------
// The intake form sends ad_ons as a JSON-encoded array:
//   [{"text": "Foam", "amount": 500}, {"text": "Curtains", "amount": 300}]
//
// Legacy rows in the DB may still hold [{text}] (no amount). This parser
// handles both. If parsing fails, falls back to comma-separated text.

type ParsedAddOn = { text: string; amount: number };

function parseAdOns(raw: string | null | undefined): ParsedAddOn[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (trimmed.length === 0) return [];

  // Try JSON first
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .filter(
            (x) =>
              x &&
              typeof x === "object" &&
              typeof (x as any).text === "string" &&
              String((x as any).text).trim().length > 0
          )
          .map((x) => ({
            text: String((x as any).text).trim(),
            amount: Number.isFinite(Number((x as any).amount))
              ? Number((x as any).amount)
              : 0,
          }));
      }
    } catch {
      // fall through to legacy parsing
    }
  }

  // Legacy: comma-separated text
  return trimmed
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((text) => ({ text, amount: 0 }));
}

function sumAdOns(rows: ParsedAddOn[]): number {
  return rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
}

export type IntakeResult = {
  tenant_id: string;
  lease_id: string;
  contract_id: string;
  unit_id: string;
  is_new_tenant: boolean;
  is_new_lease: boolean;
};

export async function createTenantWithLeaseAndContract(
  input: IntakeInput
): Promise<IntakeResult> {
  const admin = createAdminClient();

  // ---- 1. Resolve property ----
  const { data: property, error: propErr } = await admin
    .schema("core")
    .from("property")
    .select("id, name")
    .ilike("name", input.building.trim())
    .maybeSingle();
  if (propErr) throw new Error("Property lookup failed: " + propErr.message);
  if (!property) throw new Error("Property not found: " + input.building);

  // ---- 2. Resolve unit ----
  const { data: unit, error: unitErr } = await admin
    .schema("core")
    .from("unit")
    .select("id, unit_number, status")
    .eq("property_id", (property as { id: string }).id)
    .ilike("unit_number", input.unit_no.trim())
    .maybeSingle();
  if (unitErr) throw new Error("Unit lookup failed: " + unitErr.message);
  if (!unit)
    throw new Error(
      "Unit " + input.unit_no + " not found in " + (property as { name: string }).name
    );

  // ---- 3. Tenant: find by email, else insert ----
  const email = input.email.trim().toLowerCase();
  const full_name = [input.first_name, input.middle_name, input.last_name]
    .filter((s) => s && s.trim())
    .join(" ");

  const tenantPayload = {
    full_name,
    first_name: input.first_name.trim(),
    middle_name: toNull(input.middle_name),
    last_name: input.last_name.trim(),
    email,
    phone: toNull(input.mobile),
    messenger_name: toNull(input.messenger),
    age: toNull(input.age),
    gender: toNull(input.gender),
    nationality: toNull(input.nationality),
    religion: toNull(input.religion),
    civil_status: toNull(input.civil_status),
    permanent_address: toNull(input.perm_address),
    recent_address: toNull(input.rec_address),
    company: toNull(input.company),
    work_status: toNull(input.work_status),
    work_position: toNull(input.position),
    company_address: toNull(input.comp_addr),
    company_tel: toNull(input.comp_tel),
    company_email: toNull(input.comp_email),
    company_messenger: toNull(input.comp_mssgr),
    marketing_source: toNull(input.marketing_src),
    ec1_name: toNull(input.ec1_name),
    ec1_phone: toNull(input.ec1_tel),
    ec1_email: toNull(input.ec1_email),
    ec1_messenger: toNull(input.ec1_mssgr),
    ec2_name: toNull(input.ec2_name),
    ec2_phone: toNull(input.ec2_tel),
    ec2_email: toNull(input.ec2_email),
    ec2_messenger: toNull(input.ec2_mssgr),
    status: "active" as const,
  };

  const { data: existingTenant } = await admin
    .schema("core")
    .from("tenant")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  let tenantId: string;
  let isNewTenant = false;
  if (existingTenant) {
    const { error: upErr } = await admin
      .schema("core")
      .from("tenant")
      .update(tenantPayload)
      .eq("id", (existingTenant as { id: string }).id);
    if (upErr) throw new Error("Tenant update failed: " + upErr.message);
    tenantId = (existingTenant as { id: string }).id;
  } else {
    const { data: inserted, error: insErr } = await admin
      .schema("core")
      .from("tenant")
      .insert(tenantPayload)
      .select("id")
      .single();
    if (insErr) throw new Error("Tenant insert failed: " + insErr.message);
    tenantId = (inserted as { id: string }).id;
    isNewTenant = true;
  }

  // ---- 4. Parse add-ons (per-row amounts) ----
  const parsedAdOns = parseAdOns(input.ad_ons);
  const computedAdOnsAmount = sumAdOns(parsedAdOns);

  // ---- 5. Lease: find by tenant + unit, else insert ----
  const { data: existingLease } = await admin
    .schema("core")
    .from("lease")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("unit_id", (unit as { id: string }).id)
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const leasePayload = {
    tenant_id: tenantId,
    unit_id: (unit as { id: string }).id,
    start_date: input.rental_start,
    end_date: input.rental_end,
    move_in_date: input.rental_start,
    monthly_rent: input.rate,
    deposit_amount: input.sec_dep ?? 0,
    deposit_1: input.sec_dep ?? 0,
    deposit_2: 0,
    ad_ons: parsedAdOns,
    ad_ons_amount: computedAdOnsAmount,
    notice_period_days: 30,
    status: "active" as const,
    term: "6_months" as const,
  };

  let leaseId: string;
  let isNewLease = false;
  if (existingLease) {
    const { error: upErr } = await admin
      .schema("core")
      .from("lease")
      .update(leasePayload)
      .eq("id", (existingLease as { id: string }).id);
    if (upErr) throw new Error("Lease update failed: " + upErr.message);
    leaseId = (existingLease as { id: string }).id;
  } else {
    const { data: inserted, error: insErr } = await admin
      .schema("core")
      .from("lease")
      .insert(leasePayload)
      .select("id")
      .single();
    if (insErr) throw new Error("Lease insert failed: " + insErr.message);
    leaseId = (inserted as { id: string }).id;
    isNewLease = true;
  }

  // ---- 6. Flip unit to occupied ----
  await admin
    .schema("core")
    .from("unit")
    .update({ status: "occupied" })
    .eq("id", (unit as { id: string }).id)
    .eq("status", "vacant");

  // ---- 7. Contract row ----
  const { data: insertedContract, error: contractErr } = await admin
    .schema("prep")
    .from("contract")
    .insert({
      lease_id: leaseId,
      template_id: null,
      generated_body: null,
      status: "signed",
      signed_at: new Date().toISOString(),
      signed_document_url: null,
      tenant_signature: input.signature,
    })
    .select("id")
    .single();
  if (contractErr) throw new Error("Contract insert failed: " + contractErr.message);
  const contractId = (insertedContract as { id: string }).id;

  // ---- 8. Inspection ----
  const inspectionPayload = {
    lease_id: leaseId,
    switches: toNull(input.switches), switches_comment: toNull(input.switches_com),
    sockets: toNull(input.sockets), sockets_comment: toNull(input.sockets_com),
    cabinet: toNull(input.cabinet), cabinet_comment: toNull(input.cabinet_com),
    lavatory: toNull(input.lavatory), lavatory_comment: toNull(input.lavatory_com),
    light_bulb: toNull(input.light_bulb), light_bulb_comment: toNull(input.light_bulb_com),
    faucets: toNull(input.faucets), faucets_comment: toNull(input.faucets_com),
    shower_head: toNull(input.shower_head), shower_head_comment: toNull(input.shower_head_com),
    declogging: toNull(input.declogging), declogging_comment: toNull(input.declogging_com),
    toilet_bowl: toNull(input.toilet_bowl), toilet_bowl_comment: toNull(input.toilet_bowl_com),
    kitchen_sink: toNull(input.kitchen_sink), kitchen_sink_comment: toNull(input.kitchen_sink_com),
    wall_paint: toNull(input.wall_paint), wall_paint_comment: toNull(input.wall_paint_com),
    optional_items: toNull(input.optional_items), optional_items_comment: toNull(input.optional_items_com),
    door: toNull(input.door), door_comment: toNull(input.door_com),
    number_of_persons: input.num_per ?? null,
    filled_by_tenant_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: existingInspection } = await admin
    .schema("prep")
    .from("unit_inspection")
    .select("id")
    .eq("lease_id", leaseId)
    .maybeSingle();

  if (existingInspection) {
    const { error: upErr } = await admin
      .schema("prep")
      .from("unit_inspection")
      .update(inspectionPayload)
      .eq("id", (existingInspection as { id: string }).id);
    if (upErr) throw new Error("Inspection update failed: " + upErr.message);
  } else {
    const { error: insErr } = await admin
      .schema("prep")
      .from("unit_inspection")
      .insert(inspectionPayload);
    if (insErr) throw new Error("Inspection insert failed: " + insErr.message);
  }

  // ---- 9. Audit ----
  await admin
    .schema("core")
    .from("audit_log")
    .insert({
      actor_user_id: null,
      entity_type: "contract",
      entity_id: contractId,
      action: "create",
      after: {
        source: "native_intake_form",
        tenant_id: tenantId,
        lease_id: leaseId,
        unit_id: (unit as { id: string }).id,
        ad_ons_count: parsedAdOns.length,
        ad_ons_amount: computedAdOnsAmount,
      },
      reason: "Tenant self-service intake submission",
    });

  return {
    tenant_id: tenantId,
    lease_id: leaseId,
    contract_id: contractId,
    unit_id: (unit as { id: string }).id,
    is_new_tenant: isNewTenant,
    is_new_lease: isNewLease,
  };
}