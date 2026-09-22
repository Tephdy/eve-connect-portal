"use server";

import { revalidatePath } from "next/cache";
import { assertPermission } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/admin";

type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function createRateAction(formData: FormData): Promise<ActionResult> {
  try {
    await assertPermission("utility:manage");
  } catch {
    return { ok: false, error: "Forbidden: missing utility:manage" };
  }

  const property_id_raw = String(formData.get("property_id") ?? "").trim();
  const utility_type = String(formData.get("utility_type") ?? "").trim();
  const rate_per_unit = Number(formData.get("rate_per_unit") ?? NaN);
  const effective_from = String(formData.get("effective_from") ?? "").trim();

  if (!utility_type) return { ok: false, error: "Utility type is required" };
  if (!Number.isFinite(rate_per_unit) || rate_per_unit < 0)
    return { ok: false, error: "Rate must be a non-negative number" };
  if (!effective_from) return { ok: false, error: "Effective date is required" };

  const admin = createAdminClient();
  const { error } = await admin.schema("acct").from("utility_rate").insert({
    property_id: property_id_raw || null,
    utility_type,
    rate_per_unit,
    effective_from,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/property/utilities/rates");
  revalidatePath("/property/utilities/billing");
  return { ok: true, data: null };
}

export async function endRateAction(formData: FormData): Promise<ActionResult> {
  try {
    await assertPermission("utility:manage");
  } catch {
    return { ok: false, error: "Forbidden: missing utility:manage" };
  }

  const id = String(formData.get("id") ?? "").trim();
  const effective_to = String(formData.get("effective_to") ?? "").trim();
  if (!id) return { ok: false, error: "Rate id is required" };
  if (!effective_to) return { ok: false, error: "End date is required" };

  const admin = createAdminClient();
  const { error } = await admin
    .schema("acct")
    .from("utility_rate")
    .update({ effective_to })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/property/utilities/rates");
  return { ok: true, data: null };
}
