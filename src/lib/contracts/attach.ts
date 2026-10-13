// @@CONTRACT_ENGINE:attach
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildContractContext } from "./build-context";
import { renderContractContext } from "./render";
import { controlNumberFromId, barcodeValueFor } from "./control-number";

// ---------------------------------------------------------------------------
// Map lease.term values (from src/lib/schemas/lease.ts + import/commit.ts)
// to prep.contract_template.term_type values.
// ---------------------------------------------------------------------------
export const TERM_TO_TEMPLATE: Record<string, string> = {
  "1_month":  "one_month",
  "3_months": "three_months",
  "6_months": "six_months",
  "1_year":   "long_term",
  "2_years":  "long_term",
  "3_years":  "long_term",
  trial:            "trial",
  extended_trial:   "extended_trial",
  monthly:          "monthly",
  long_term:        "long_term",
  one_month:        "one_month",
  three_months:     "three_months",
  six_months:       "six_months",
};

export function templateTermType(leaseTerm: string | null | undefined): string {
  if (!leaseTerm) return "long_term";
  return TERM_TO_TEMPLATE[leaseTerm] ?? "long_term";
}

// ---------------------------------------------------------------------------
// Pick the best matching active template for a property + term type.
// Preference: property-specific → generic fallback.
// ---------------------------------------------------------------------------
export async function pickTemplateFor(
  propertyId: string,
  termType: string
): Promise<{ id: string; body_markdown: string } | null> {
  const admin = createAdminClient();

  // Try property-specific first
  const { data: specific } = await admin
    .schema("prep")
    .from("contract_template")
    .select("id, body_markdown")
    .eq("active", true)
    .eq("term_type", termType)
    .eq("property_id", propertyId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (specific) return specific;

  // Fall back to generic
  const { data: generic } = await admin
    .schema("prep")
    .from("contract_template")
    .select("id, body_markdown")
    .eq("active", true)
    .eq("term_type", termType)
    .is("property_id", null)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  return generic ?? null;
}

// ---------------------------------------------------------------------------
// Assign control_number + barcode_value to a lease if missing.
// Deterministic from lease id — stable across reruns.
// ---------------------------------------------------------------------------
export async function ensureLeaseControlNumber(leaseId: string): Promise<{
  control_number: string;
  barcode_value: string;
}> {
  const admin = createAdminClient();

  const { data: lease } = await admin
    .schema("core")
    .from("lease")
    .select("control_number, barcode_value")
    .eq("id", leaseId)
    .single();

  const control_number = lease?.control_number ?? controlNumberFromId(leaseId);
  const barcode_value = lease?.barcode_value ?? barcodeValueFor(control_number);

  if (!lease?.control_number || !lease?.barcode_value) {
    await admin
      .schema("core")
      .from("lease")
      .update({ control_number, barcode_value })
      .eq("id", leaseId);
  }

  return { control_number, barcode_value };
}

// ---------------------------------------------------------------------------
// Render + upsert the contract body for a lease.
// Non-fatal on failure: logs and returns null so callers don't break.
// ---------------------------------------------------------------------------
export async function renderContractForLease(
  leaseId: string,
  opts: { repName?: string | null } = {}
): Promise<{ contract_id: string; template_id: string; body_length: number } | null> {
  const admin = createAdminClient();

  try {
    // 1. Ensure control number exists
    await ensureLeaseControlNumber(leaseId);

    // 2. Look up lease → unit → property → term
    const { data: lease } = await admin
      .schema("core")
      .from("lease")
      .select("id, unit_id, term")
      .eq("id", leaseId)
      .single();
    if (!lease) throw new Error("lease not found: " + leaseId);

    const { data: unit } = await admin
      .schema("core")
      .from("unit")
      .select("id, property_id")
      .eq("id", lease.unit_id)
      .single();
    if (!unit) throw new Error("unit not found: " + lease.unit_id);

    // 3. Pick template
    const termType = templateTermType(lease.term);
    const template = await pickTemplateFor(unit.property_id, termType);
    if (!template) {
      console.warn(
        `[renderContractForLease] No active template for property ${unit.property_id} / term_type ${termType}`
      );
      return null;
    }

    // 4. Build context + render
    const ctx = await buildContractContext({
      leaseId,
      repName: opts.repName ?? null,
    });
    const rendered = renderContractContext(template.body_markdown, ctx);

    // 5. Upsert contract row
    const { data: existing } = await admin
      .schema("prep")
      .from("contract")
      .select("id")
      .eq("lease_id", leaseId)
      .limit(1)
      .maybeSingle();

    let contractId: string;
    if (existing) {
      const { error: upErr } = await admin
        .schema("prep")
        .from("contract")
        .update({
          template_id: template.id,
          generated_body: rendered,
        })
        .eq("id", existing.id);
      if (upErr) throw new Error("update failed: " + upErr.message);
      contractId = existing.id;
    } else {
      const { data: inserted, error: insErr } = await admin
        .schema("prep")
        .from("contract")
        .insert({
          lease_id: leaseId,
          template_id: template.id,
          generated_body: rendered,
          // @@CONTRACT_ENGINE:attach-draft
          // Contract starts as draft; tenant signs later via portal.
          status: "draft",
          signed_at: null,
          signed_document_url: null,
          tenant_signature: null,
        })
        .select("id")
        .single();
      if (insErr) throw new Error("insert failed: " + insErr.message);
      contractId = inserted.id;
    }

    return {
      contract_id: contractId,
      template_id: template.id,
      body_length: rendered.length,
    };
  } catch (err) {
    console.error(
      "[renderContractForLease]",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}
