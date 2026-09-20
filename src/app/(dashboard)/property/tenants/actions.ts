"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertPermission } from "@/lib/auth/guard";
import { getSession } from "@/lib/auth/get-session";
import { createTenant, updateTenant } from "@/lib/db/tenants";
import { logAudit } from "@/lib/audit/log";
import { tenantCreateSchema, tenantUpdateSchema } from "@/lib/schemas/tenant";
import { parseForm } from "@/lib/forms/parse";
import type { ActionResult } from "@/lib/actions/result";

export async function createTenantAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await assertPermission("tenant:create");
  const parsed = parseForm(tenantCreateSchema, formData);
  if (!parsed.ok) return { ok: false, error: parsed.error, fieldErrors: parsed.fieldErrors };
  const session = await getSession();
  const tenant = await createTenant(parsed.data);
  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "tenant",
    entity_id: tenant.id,
    action: "create",
    after: tenant,
  });
  revalidatePath("/property/tenants");
  redirect("/property/tenants/" + tenant.id);
}

export async function updateTenantAction(
  id: string,
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await assertPermission("tenant:update");
  const parsed = parseForm(tenantUpdateSchema, formData);
  if (!parsed.ok) return { ok: false, error: parsed.error, fieldErrors: parsed.fieldErrors };
  const session = await getSession();
  const updated = await updateTenant(id, parsed.data);
  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "tenant",
    entity_id: id,
    action: "update",
    after: updated,
  });
  revalidatePath("/property/tenants");
  revalidatePath("/property/tenants/" + id);
  return { ok: true, data: undefined };
}
