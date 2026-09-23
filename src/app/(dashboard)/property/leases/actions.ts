"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertPermission } from "@/lib/auth/guard";
import { getSession } from "@/lib/auth/get-session";
import { createLease, updateLease, terminateLease } from "@/lib/db/leases";
import { markReservationLeased, releaseReservation } from "@/lib/db/unit-reservations";
import { logAudit } from "@/lib/audit/log";
import { leaseCreateSchema, leaseUpdateSchema } from "@/lib/schemas/lease";
import { parseForm } from "@/lib/forms/parse";
import type { ActionResult } from "@/lib/actions/result";

export async function createLeaseAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await assertPermission("lease:create");
  const parsed = parseForm(leaseCreateSchema, formData);
  if (!parsed.ok) return { ok: false, error: parsed.error, fieldErrors: parsed.fieldErrors };
  const session = await getSession();
  const fromReservationId =
    String(formData.get("from_reservation_id") ?? "").trim() || null;

  const lease = await createLease({
    ...parsed.data,
    reservation_id: fromReservationId,
  });

  // If created from a reservation: flip lease_status to active + unit to occupied
  if (fromReservationId) {
    try {
      await markReservationLeased({
        reservation_id: fromReservationId,
        actor_id: session?.id ?? null,
      });

      // Close the reservation (this is its terminal state — it produced a lease)
      try {
        await releaseReservation({
          unit_id: lease.unit_id,
          released_by: session?.id ?? null,
          reason: "Lease created: " + lease.id,
          new_status: "occupied",
        });
      } catch (err) {
        console.error("[createLeaseAction] releaseReservation failed:", err);
      }

      // Flip unit status — we know the unit_id from the lease we just created
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const admin = createAdminClient();
      await admin
        .from("unit")
        .update({ status: "occupied" })
        .eq("id", lease.unit_id);
    } catch (err) {
      console.error("[createLeaseAction] reservation linkage failed:", err);
    }
  }
  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "lease",
    entity_id: lease.id,
    action: "create",
    after: lease,
  });
  revalidatePath("/property/leases");
  revalidatePath("/accounting/reservations");
  revalidatePath("/marketing/forecast");
  redirect("/property/leases/" + lease.id);
}

export async function updateLeaseAction(
  id: string,
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await assertPermission("lease:update");
  const parsed = parseForm(leaseUpdateSchema, formData);
  if (!parsed.ok) return { ok: false, error: parsed.error, fieldErrors: parsed.fieldErrors };
  const session = await getSession();
  const updated = await updateLease(id, parsed.data);
  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "lease",
    entity_id: id,
    action: "update",
    after: updated,
  });
  revalidatePath("/property/leases");
  revalidatePath("/property/leases/" + id);
  return { ok: true, data: undefined };
}

export async function terminateLeaseAction(id: string): Promise<void> {
  await assertPermission("lease:terminate");
  const session = await getSession();
  await terminateLease(id);
  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "lease",
    entity_id: id,
    action: "archive",
    reason: "terminated",
  });
  revalidatePath("/property/leases");
  redirect("/property/leases");
}
