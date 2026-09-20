"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertPermission } from "@/lib/auth/guard";
import { getSession } from "@/lib/auth/get-session";
import { createUnit, updateUnit } from "@/lib/db/units";
import { logAudit } from "@/lib/audit/log";
import { unitCreateSchema, unitUpdateSchema } from "@/lib/schemas/unit";
import { parseForm } from "@/lib/forms/parse";
import type { ActionResult } from "@/lib/actions/result";

export async function createUnitAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await assertPermission("unit:create");
  const parsed = parseForm(unitCreateSchema, formData);
  if (!parsed.ok) return { ok: false, error: parsed.error, fieldErrors: parsed.fieldErrors };
  const session = await getSession();
  const unit = await createUnit(parsed.data);
  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "unit",
    entity_id: unit.id,
    action: "create",
    after: unit,
  });
  revalidatePath("/property/units");
  redirect("/property/units/" + unit.id);
}

export async function updateUnitAction(
  id: string,
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await assertPermission("unit:update");
  const parsed = parseForm(unitUpdateSchema, formData);
  if (!parsed.ok) return { ok: false, error: parsed.error, fieldErrors: parsed.fieldErrors };
  const session = await getSession();
  const updated = await updateUnit(id, parsed.data);
  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "unit",
    entity_id: id,
    action: "update",
    after: updated,
  });
  revalidatePath("/property/units");
  revalidatePath("/property/units/" + id);
  return { ok: true, data: undefined };
}
