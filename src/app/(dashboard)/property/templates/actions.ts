"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertPermission } from "@/lib/auth/guard";
import { getSession } from "@/lib/auth/get-session";
import { createTemplate, updateTemplate, archiveTemplate } from "@/lib/db/templates";
import { logAudit } from "@/lib/audit/log";
import { templateCreateSchema, templateUpdateSchema } from "@/lib/schemas/contract";
import { parseForm } from "@/lib/forms/parse";
import type { ActionResult } from "@/lib/actions/result";

export async function createTemplateAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await assertPermission("template:manage");
  const parsed = parseForm(templateCreateSchema, formData);
  if (!parsed.ok) return { ok: false, error: parsed.error, fieldErrors: parsed.fieldErrors };
  const session = await getSession();
  const tpl = await createTemplate(parsed.data);
  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "contract_template",
    entity_id: tpl.id,
    action: "create",
    after: tpl,
  });
  revalidatePath("/property/templates");
  redirect("/property/templates/" + tpl.id);
}

export async function updateTemplateAction(
  id: string,
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await assertPermission("template:manage");
  const parsed = parseForm(templateUpdateSchema, formData);
  if (!parsed.ok) return { ok: false, error: parsed.error, fieldErrors: parsed.fieldErrors };
  const session = await getSession();
  const updated = await updateTemplate(id, parsed.data);
  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "contract_template",
    entity_id: id,
    action: "update",
    after: updated,
  });
  revalidatePath("/property/templates");
  revalidatePath("/property/templates/" + id);
  return { ok: true, data: undefined };
}

export async function archiveTemplateAction(id: string): Promise<void> {
  await assertPermission("template:manage");
  const session = await getSession();
  await archiveTemplate(id);
  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "contract_template",
    entity_id: id,
    action: "archive",
  });
  revalidatePath("/property/templates");
  redirect("/property/templates");
}
