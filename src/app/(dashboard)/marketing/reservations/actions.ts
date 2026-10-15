"use server";
// @@CONTRACT_ENGINE:reservation-ui-actions
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertPermission } from "@/lib/auth/guard";
import { getSession } from "@/lib/auth/get-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit/log";
import { renderReservationContract } from "@/lib/contracts/reservation-attach";
import type { ActionResult } from "@/lib/actions/result";

export async function regenerateReservationContractAction(
  reservationId: string
): Promise<ActionResult> {
  await assertPermission("unit:read");
  const session = await getSession();

  try {
    const result = await renderReservationContract(reservationId);
    if (!result) {
      return { ok: false, error: "Render failed - check dev console for details." };
    }

    await logAudit({
      actor_id: session?.id ?? null,
      entity_type: "reservation_contract",
      entity_id: result.contract_id,
      action: "update",
      after: {
        reservation_id: reservationId,
        template_id: result.template_id,
        body_length: result.body_length,
      },
      reason: "Manual regenerate from marketing reservations",
    });

    revalidatePath("/marketing/reservations");
    revalidatePath("/marketing/reservations/" + reservationId);
    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Regenerate failed",
    };
  }
}

export async function deleteReservationAction(
  reservationId: string
): Promise<ActionResult> {
  await assertPermission("unit:reserve");
  const session = await getSession();

  const admin = createAdminClient();

  try {
    // Look up the reservation first
    const { data: res } = await admin
      .schema("acct")
      .from("unit_reservation")
      .select("id, unit_id, client_name, valid_id_path")
      .eq("id", reservationId)
      .maybeSingle();

    if (!res) {
      return { ok: false, error: "Reservation not found" };
    }

    // If the unit is currently marked reserved AND this is its only open
    // reservation, flip the unit back to vacant.
    const { data: otherOpen } = await admin
      .schema("acct")
      .from("unit_reservation")
      .select("id")
      .eq("unit_id", res.unit_id)
      .is("released_at", null)
      .neq("id", reservationId)
      .limit(1)
      .maybeSingle();

    if (!otherOpen) {
      await admin
        .schema("core")
        .from("unit")
        .update({ status: "vacant" })
        .eq("id", res.unit_id)
        .eq("status", "reserved");
    }

    // Delete the reservation (contract cascades via FK)
    const { error: delErr } = await admin
      .schema("acct")
      .from("unit_reservation")
      .delete()
      .eq("id", reservationId);

    if (delErr) {
      return { ok: false, error: delErr.message };
    }

    if (res.valid_id_path) {
      const { error: storageError } = await admin.storage
        .from("reservation-ids")
        .remove([res.valid_id_path]);
      if (storageError) {
        console.error("[deleteReservationAction] valid ID cleanup failed:", storageError);
      }
    }

    await logAudit({
      actor_id: session?.id ?? null,
      entity_type: "unit_reservation",
      entity_id: reservationId,
      action: "delete",
      after: { client_name: res.client_name, unit_id: res.unit_id },
    });

    revalidatePath("/marketing/reservations");
    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Delete failed",
    };
  }
}

export async function deleteReservationAndRedirectAction(
  reservationId: string
): Promise<void> {
  const r = await deleteReservationAction(reservationId);
  if (r.ok) redirect("/marketing/reservations");
  redirect("/marketing/reservations/" + reservationId + "?error=" + encodeURIComponent(r.error));
}

// @@CONTRACT_ENGINE:reservation-action-update
export async function updateReservationAction(
  reservationId: string,
  formData: FormData
): Promise<ActionResult> {
  await assertPermission("unit:reserve");
  const session = await getSession();

  const admin = createAdminClient();

  try {
    const client_name = String(formData.get("client_name") ?? "").trim();
    if (!client_name) {
      return { ok: false, error: "Client name is required" };
    }

    const client_phone = String(formData.get("client_phone") ?? "").trim() || null;
    const client_email = String(formData.get("client_email") ?? "").trim() || null;
    const gender = String(formData.get("gender") ?? "").trim() || null;
    const company = String(formData.get("company") ?? "").trim() || null;
    const position = String(formData.get("position") ?? "").trim() || null;
    const vehicle_plate = String(formData.get("vehicle_plate") ?? "").trim() || null;
    const declared_occupants_raw = String(formData.get("declared_occupants") ?? "").trim();
    const declared_occupants = declared_occupants_raw ? Number(declared_occupants_raw) : null;

    const reservation_fee_raw = String(formData.get("reservation_fee") ?? "").trim();
    const reservation_fee = reservation_fee_raw ? Number(reservation_fee_raw) : null;

    const payment_mode_raw = String(formData.get("payment_mode") ?? "").trim();
    const valid_modes = ["cash", "gcash", "bank", "check", "other"] as const;
    const payment_mode =
      payment_mode_raw && (valid_modes as readonly string[]).includes(payment_mode_raw)
        ? (payment_mode_raw as (typeof valid_modes)[number])
        : null;

    const reference_number = String(formData.get("reference_number") ?? "").trim() || null;

    const intent = String(formData.get("intent") ?? "").trim() || null;
    const term = String(formData.get("term") ?? "").trim() || null;
    const lease_start_date = String(formData.get("lease_start_date") ?? "").trim() || null;
    const lease_end_date = String(formData.get("lease_end_date") ?? "").trim() || null;
    const move_in_date = String(formData.get("move_in_date") ?? "").trim() || null;
    const rent_due_date = String(formData.get("rent_due_date") ?? "").trim() || null;

    const monthly_rent_raw = String(formData.get("monthly_rent") ?? "").trim();
    const monthly_rent = monthly_rent_raw ? Number(monthly_rent_raw) : null;

    const deposit_1_raw = String(formData.get("deposit_1") ?? "").trim();
    const deposit_1 = deposit_1_raw ? Number(deposit_1_raw) : null;

    const deposit_2_raw = String(formData.get("deposit_2") ?? "").trim();
    const deposit_2 = deposit_2_raw ? Number(deposit_2_raw) : null;

    const deposit_1_due_date = String(formData.get("deposit_1_due_date") ?? "").trim() || null;
    const deposit_2_due_date = String(formData.get("deposit_2_due_date") ?? "").trim() || null;

    const notice_period_days_raw = String(formData.get("notice_period_days") ?? "").trim();
    const notice_period_days = notice_period_days_raw ? Number(notice_period_days_raw) : null;

    const lease_status_raw = String(formData.get("lease_status") ?? "draft").trim();
    const lease_status = lease_status_raw === "active" ? "active" : "draft";

    const addOnLabels = formData.getAll("add_on_label").map((v) => String(v).trim());
    const addOnAmounts = formData.getAll("add_on_amount").map((v) => Number(String(v).trim() || "0"));
    const add_ons = addOnLabels
      .map((label, i) => ({ label, amount: Number.isFinite(addOnAmounts[i]) ? addOnAmounts[i] : 0 }))
      .filter((a) => a.label.length > 0);
    const add_ons_amount = add_ons.reduce((s, a) => s + a.amount, 0);

    const { updateReservation } = await import("@/lib/db/unit-reservations");
    const updated = await updateReservation(reservationId, {
      client_name,
      client_phone,
      client_email,
      gender,
      company,
      position,
      vehicle_plate,
      declared_occupants,
      reservation_fee,
      payment_mode,
      reference_number,
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

    // Auto-regenerate the contract body to reflect the new values
    try {
      const { renderReservationContract } = await import(
        "@/lib/contracts/reservation-attach"
      );
      await renderReservationContract(reservationId);
    } catch (regenErr) {
      console.error(
        "[updateReservationAction] contract regen failed:",
        regenErr instanceof Error ? regenErr.message : regenErr
      );
    }

    await logAudit({
      actor_id: session?.id ?? null,
      entity_type: "unit_reservation",
      entity_id: reservationId,
      action: "update",
      after: updated,
    });

    revalidatePath("/marketing/reservations");
    revalidatePath("/marketing/reservations/" + reservationId);
    revalidatePath("/marketing/reservations/" + reservationId + "/edit");
    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Update failed",
    };
  }
}
