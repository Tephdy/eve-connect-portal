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
      .select("id, unit_id, client_name")
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
