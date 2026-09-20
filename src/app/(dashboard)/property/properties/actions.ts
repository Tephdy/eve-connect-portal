"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertPermission } from "@/lib/auth/guard";
import { getSession } from "@/lib/auth/get-session";
import { createProperty, updateProperty, archiveProperty } from "@/lib/db/properties";
import { logAudit } from "@/lib/audit/log";
import { propertyCreateSchema, propertyUpdateSchema } from "@/lib/schemas/property";
import { parseForm } from "@/lib/forms/parse";
import type { ActionResult } from "@/lib/actions/result";

export async function createPropertyAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await assertPermission("property:create");
  const parsed = parseForm(propertyCreateSchema, formData);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error, fieldErrors: parsed.fieldErrors };
  }
  const session = await getSession();
  const property = await createProperty(parsed.data);
  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "property",
    entity_id: property.id,
    action: "create",
    after: property,
  });
  revalidatePath("/property/properties");
  redirect("/property/properties/" + property.id);
}

export async function updatePropertyAction(
  id: string,
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await assertPermission("property:update");
  const parsed = parseForm(propertyUpdateSchema, formData);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error, fieldErrors: parsed.fieldErrors };
  }
  const session = await getSession();
  const updated = await updateProperty(id, parsed.data);
  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "property",
    entity_id: id,
    action: "update",
    after: updated,
  });
  revalidatePath("/property/properties");
  revalidatePath("/property/properties/" + id);
  return { ok: true, data: undefined };
}

export async function archivePropertyAction(id: string): Promise<void> {
  await assertPermission("property:archive");
  const session = await getSession();
  await archiveProperty(id);
  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "property",
    entity_id: id,
    action: "archive",
  });
  revalidatePath("/property/properties");
  redirect("/property/properties");
}
