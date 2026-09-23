"use server";

import { revalidatePath } from "next/cache";
import { assertPermission } from "@/lib/auth/guard";
import { getSession } from "@/lib/auth/get-session";
import { upsertForecast, recalculateForecasts } from "@/lib/db/forecast";
import { createReservation, releaseReservation } from "@/lib/db/unit-reservations";
import { logAudit } from "@/lib/audit/log";
import { emit } from "@/lib/events/emit";
import { forecastOverrideSchema } from "@/lib/schemas/listing";
import { parseForm } from "@/lib/forms/parse";
import type { ActionResult } from "@/lib/actions/result";

export async function overrideForecastAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await assertPermission("forecast:override");
  const parsed = parseForm(forecastOverrideSchema, formData);
  if (!parsed.ok) return { ok: false, error: parsed.error, fieldErrors: parsed.fieldErrors };

  const session = await getSession();
  const result = await upsertForecast({
    unit_id: parsed.data.unit_id,
    earliest_available_date: parsed.data.earliest_available_date,
    confidence: parsed.data.confidence,
    notes: parsed.data.notes || null,
  });

  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "availability_forecast",
    entity_id: result.id,
    action: "update",
    after: result,
  });

  await emit("forecast.recalculated", {
    unit_id: result.unit_id,
    earliest_available_date: result.earliest_available_date,
    confidence: result.confidence,
  }, session?.id ?? null);

  revalidatePath("/marketing/forecast");
  return { ok: true, data: undefined };
}

export async function recalculateAllAction(): Promise<void> {
  await assertPermission("forecast:override");
  await recalculateForecasts();
  revalidatePath("/marketing/forecast");
}


// ---------------------------------------------------------------------------
// Reservation actions (marketing)
// ---------------------------------------------------------------------------

export async function reserveUnitAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await assertPermission("unit:reserve");
  const session = await getSession();

  const unit_id = String(formData.get("unit_id") ?? "").trim();
  const client_name = String(formData.get("client_name") ?? "").trim();
  const client_phone = String(formData.get("client_phone") ?? "").trim() || null;
  const client_email = String(formData.get("client_email") ?? "").trim() || null;
  const reservation_fee_raw = String(formData.get("reservation_fee") ?? "").trim();
  const payment_mode_raw = String(formData.get("payment_mode") ?? "").trim();
  const reference_number = String(formData.get("reference_number") ?? "").trim() || null;
  const inquiry_id = String(formData.get("reserve_inquiry_id") ?? "").trim() || null;

  // Lease-draft fields
  const intent = String(formData.get("intent") ?? "").trim() || null;
  const term = String(formData.get("term") ?? "").trim() || null;
  const lease_start_date = String(formData.get("lease_start_date") ?? "").trim() || null;
  const lease_end_date = String(formData.get("lease_end_date") ?? "").trim() || null;
  const move_in_date = String(formData.get("move_in_date") ?? "").trim() || null;
  const rent_due_date = String(formData.get("rent_due_date") ?? "").trim() || null;
  const monthly_rent_raw = String(formData.get("monthly_rent") ?? "").trim();
  const deposit_1_raw = String(formData.get("deposit_1") ?? "").trim();
  const deposit_2_raw = String(formData.get("deposit_2") ?? "").trim();
  const deposit_1_due_date = String(formData.get("deposit_1_due_date") ?? "").trim() || null;
  const deposit_2_due_date = String(formData.get("deposit_2_due_date") ?? "").trim() || null;
  const notice_period_days_raw = String(formData.get("notice_period_days") ?? "").trim();
  const lease_status_raw = String(formData.get("lease_status") ?? "draft").trim();

  const addOnLabels = formData.getAll("add_on_label").map((v) => String(v).trim());
  const addOnAmounts = formData.getAll("add_on_amount").map((v) => Number(String(v).trim() || "0"));
  const add_ons = addOnLabels
    .map((label, i) => ({ label, amount: Number.isFinite(addOnAmounts[i]) ? addOnAmounts[i] : 0 }))
    .filter((a) => a.label.length > 0);
  const add_ons_amount = add_ons.reduce((s, a) => s + a.amount, 0);

  const monthly_rent = monthly_rent_raw ? Number(monthly_rent_raw) : null;
  const deposit_1 = deposit_1_raw ? Number(deposit_1_raw) : null;
  const deposit_2 = deposit_2_raw ? Number(deposit_2_raw) : null;
  const notice_period_days = notice_period_days_raw ? Number(notice_period_days_raw) : null;
  const lease_status = lease_status_raw === "active" ? "active" : "draft";

  if (!unit_id) return { ok: false, error: "Missing unit" };
  if (!client_name) return { ok: false, error: "Client name is required" };

  const reservation_fee = reservation_fee_raw ? Number(reservation_fee_raw) : null;
  if (reservation_fee !== null && (!Number.isFinite(reservation_fee) || reservation_fee < 0)) {
    return { ok: false, error: "Reservation fee must be a non-negative number" };
  }

  const valid_modes = ["cash", "gcash", "bank", "check", "other"] as const;
  const payment_mode =
    payment_mode_raw && (valid_modes as readonly string[]).includes(payment_mode_raw)
      ? (payment_mode_raw as (typeof valid_modes)[number])
      : null;

  try {
    const res = await createReservation({
      unit_id,
      client_name,
      client_phone,
      client_email,
      reservation_fee,
      payment_mode,
      reference_number,
      reserved_by: session?.id ?? null,
      inquiry_id,
      intent,
      term,
      lease_start_date,
      lease_end_date,
      move_in_date,
      rent_due_date,
      monthly_rent,
      deposit_1,
      deposit_2,
      deposit_1_due_date,
      deposit_2_due_date,
      add_ons,
      add_ons_amount,
      notice_period_days,
      lease_status,
    });

    await logAudit({
      actor_id: session?.id ?? null,
      entity_type: "unit_reservation",
      entity_id: res.id,
      action: "create",
      after: res,
    });

    revalidatePath("/marketing/forecast");
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to reserve" };
  }
}

export async function unreserveUnitAction(unit_id: string): Promise<ActionResult> {
  await assertPermission("unit:reserve");
  const session = await getSession();

  try {
    await releaseReservation({
      unit_id,
      released_by: session?.id ?? null,
      reason: null,
      new_status: "vacant",
    });

    await logAudit({
      actor_id: session?.id ?? null,
      entity_type: "unit_reservation",
      entity_id: unit_id,
      action: "update",
      after: { released: true },
    });

    revalidatePath("/marketing/forecast");
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to unreserve" };
  }
}
