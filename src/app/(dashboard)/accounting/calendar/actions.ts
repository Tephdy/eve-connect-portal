"use server";

import { revalidatePath } from "next/cache";
import { assertPermission } from "@/lib/auth/guard";
import { getSession } from "@/lib/auth/get-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCalendarMonth } from "@/lib/calendar/aggregate";
import { logAudit } from "@/lib/audit/log";
import { emit } from "@/lib/events/emit";
import type { CalendarFilters, CalendarMonth } from "@/lib/calendar/types";
import type { ActionResult } from "@/lib/actions/result";

export async function loadCalendarMonthAction(input: {
  year: number;
  month: number;
  filters?: CalendarFilters;
}): Promise<ActionResult<CalendarMonth>> {
  await assertPermission("invoice:read");
  try {
    const data = await getCalendarMonth(
      input.year,
      input.month,
      input.filters ?? { types: [] }
    );
    return { ok: true, data };
  } catch (err) {
    console.error("[loadCalendarMonth]", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to load calendar",
    };
  }
}

/**
 * Move a lease's start_date or end_date to a new date.
 * Called after drag-to-reschedule in the calendar.
 */
export async function rescheduleLeaseAction(input: {
  lease_id: string;
  field: "start_date" | "end_date";
  new_date: string;
}): Promise<ActionResult<{ updated: true }>> {
  await assertPermission("lease:update");
  const session = await getSession();

  // Sanity check
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.new_date)) {
    return { ok: false, error: "Invalid date format" };
  }
  if (input.field !== "start_date" && input.field !== "end_date") {
    return { ok: false, error: "Invalid field" };
  }

  try {
    const admin = createAdminClient();

    // Fetch current lease for validation and audit
    const { data: lease, error: fetchErr } = await admin
      .from("lease")
      .select("id, start_date, end_date")
      .eq("id", input.lease_id)
      .single();

    if (fetchErr || !lease) {
      return { ok: false, error: "Lease not found" };
    }

    // Validate ordering
    if (input.field === "start_date" && input.new_date >= lease.end_date) {
      return {
        ok: false,
        error: "Start date must be before end date",
      };
    }
    if (input.field === "end_date" && input.new_date <= lease.start_date) {
      return {
        ok: false,
        error: "End date must be after start date",
      };
    }

    const { error } = await admin
      .from("lease")
      .update({ [input.field]: input.new_date })
      .eq("id", input.lease_id);

    if (error) throw error;

    await logAudit({
      actor_id: session?.id ?? null,
      entity_type: "lease",
      entity_id: input.lease_id,
      action: "update",
      before: { [input.field]: lease[input.field] },
      after: { [input.field]: input.new_date },
      reason: "rescheduled via calendar",
    });

    await emit(
      "lease.rescheduled",
      {
        lease_id: input.lease_id,
        field: input.field,
        old_date: lease[input.field],
        new_date: input.new_date,
      },
      session?.id ?? null
    );

    revalidatePath("/property/calendar");
    revalidatePath("/accounting/calendar");
    revalidatePath("/property/leases/" + input.lease_id);

    return { ok: true, data: { updated: true } };
  } catch (err) {
    console.error("[rescheduleLease]", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to reschedule",
    };
  }
}
