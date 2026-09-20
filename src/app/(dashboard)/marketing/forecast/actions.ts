"use server";

import { revalidatePath } from "next/cache";
import { assertPermission } from "@/lib/auth/guard";
import { getSession } from "@/lib/auth/get-session";
import { upsertForecast, recalculateForecasts } from "@/lib/db/forecast";
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
