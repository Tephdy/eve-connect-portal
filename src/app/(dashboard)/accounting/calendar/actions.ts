"use server";

import { assertPermission } from "@/lib/auth/guard";
import { getCalendarMonth } from "@/lib/calendar/aggregate";
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
