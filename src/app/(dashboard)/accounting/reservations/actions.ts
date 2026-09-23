"use server";

import { revalidatePath } from "next/cache";
import { assertPermission } from "@/lib/auth/guard";
import { getSession } from "@/lib/auth/get-session";
import { createReservation, releaseReservation, verifyReservation } from "@/lib/db/unit-reservations";
import { logAudit } from "@/lib/audit/log";
import type { ActionResult } from "@/lib/actions/result";

export async function createReservationAction(
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

  if (!unit_id) return { ok: false, error: "Missing unit" };
  if (!client_name) return { ok: false, error: "Client name is required" };

  const reservation_fee = reservation_fee_raw ? Number(reservation_fee_raw) : null;
  if (
    reservation_fee !== null &&
    (!Number.isFinite(reservation_fee) || reservation_fee < 0)
  ) {
    return { ok: false, error: "Reservation fee must be a non-negative number" };
  }

  const valid_modes = ["cash", "gcash", "bank", "check", "other"] as const;
  const payment_mode =
    payment_mode_raw &&
    (valid_modes as readonly string[]).includes(payment_mode_raw)
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
    });

    await logAudit({
      actor_id: session?.id ?? null,
      entity_type: "unit_reservation",
      entity_id: res.id,
      action: "create",
      after: res,
    });

    revalidatePath("/accounting/reservations");
    revalidatePath("/marketing/forecast");
    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to reserve",
    };
  }
}

export async function releaseReservationAction(input: {
  unit_id: string;
  reason?: string | null;
}): Promise<ActionResult> {
  await assertPermission("unit:reserve");
  const session = await getSession();

  try {
    await releaseReservation({
      unit_id: input.unit_id,
      released_by: session?.id ?? null,
      reason: input.reason ?? null,
      new_status: "vacant",
    });

    await logAudit({
      actor_id: session?.id ?? null,
      entity_type: "unit_reservation",
      entity_id: input.unit_id,
      action: "update",
      after: { released: true, reason: input.reason ?? null },
    });

    revalidatePath("/accounting/reservations");
    revalidatePath("/marketing/forecast");
    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to release",
    };
  }
}


// ---------------------------------------------------------------------------
// Verification action
// ---------------------------------------------------------------------------

export async function verifyReservationAction(
  id: string,
  status: "verified" | "discrepancy",
  or_reference: string | null,
  notes: string | null
): Promise<ActionResult> {
  await assertPermission("unit:reserve");
  const session = await getSession();

  try {
    const updated = await verifyReservation({
      id,
      status,
      or_reference,
      notes,
      verified_by: session?.id ?? null,
    });

    await logAudit({
      actor_id: session?.id ?? null,
      entity_type: "unit_reservation",
      entity_id: id,
      action: "update",
      after: {
        verification_status: updated.verification_status,
        or_reference: updated.or_reference,
        verification_notes: updated.verification_notes,
      },
    });

    revalidatePath("/accounting/reservations");
    revalidatePath("/accounting/reservations/" + id);
    revalidatePath("/marketing/forecast");
    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to verify",
    };
  }
}
