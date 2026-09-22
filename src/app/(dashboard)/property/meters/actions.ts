"use server";

import { revalidatePath } from "next/cache";
import { assertPermission } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/admin";

type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function createMeterAction(formData: FormData): Promise<ActionResult> {
  try {
    await assertPermission("utility:manage");
  } catch {
    return { ok: false, error: "Forbidden: missing utility:manage" };
  }

  const unit_id = String(formData.get("unit_id") ?? "").trim();
  const utility_type = String(formData.get("utility_type") ?? "").trim();
  const meter_number = String(formData.get("meter_number") ?? "").trim();
  const unit_label = String(formData.get("unit_label") ?? "unit").trim();
  const initial_reading = Number(formData.get("initial_reading") ?? 0);

  if (!unit_id) return { ok: false, error: "Unit is required" };
  if (!utility_type) return { ok: false, error: "Utility type is required" };

  const admin = createAdminClient();
  const { error } = await admin.schema("acct").from("meter").insert({
    unit_id,
    utility_type,
    meter_number: meter_number || null,
    unit_label,
    initial_reading,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/property/meters");
  revalidatePath("/property/units/" + unit_id);
  return { ok: true, data: null };
}

export async function recordReadingAction(formData: FormData): Promise<ActionResult> {
  try {
    await assertPermission("utility:record");
  } catch {
    return { ok: false, error: "Forbidden: missing utility:record" };
  }

  const meter_id = String(formData.get("meter_id") ?? "").trim();
  const reading = Number(formData.get("reading") ?? NaN);
  const reading_date = String(formData.get("reading_date") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!meter_id) return { ok: false, error: "Meter is required" };
  if (!Number.isFinite(reading) || reading < 0)
    return { ok: false, error: "Reading must be a non-negative number" };
  if (!reading_date) return { ok: false, error: "Reading date is required" };

  const admin = createAdminClient();
  const { error } = await admin
    .schema("acct")
    .from("meter_reading")
    .upsert(
      { meter_id, reading, reading_date, notes: notes || null },
      { onConflict: "meter_id,reading_date" }
    );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/property/meters/" + meter_id);
  revalidatePath("/property/meters");
  revalidatePath("/property/utilities/billing");
  return { ok: true, data: null };
}
