"use server";

import { revalidatePath } from "next/cache";
import { assertTenantSelf } from "@/lib/auth/require-tenant-self";
import { updateMyProfile, upsertMyInspection } from "@/lib/db/tenant-portal";
import { logAudit } from "@/lib/audit/log";
import { tenantProfileUpdateSchema, inspectionUpdateSchema } from "@/lib/schemas/tenant-profile";
import type { ActionResult } from "@/lib/actions/result";

export async function updateMyProfileAction(
  formData: FormData
): Promise<ActionResult<{ ok: true }>> {
  let ctx;
  try {
    ctx = await assertTenantSelf();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Not authorized" };
  }

  const raw = Object.fromEntries(formData.entries());
  const parsed = tenantProfileUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (!fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields", fieldErrors };
  }

  try {
    await updateMyProfile(ctx.tenant.id, parsed.data);

    await logAudit({
      actor_id: ctx.session.id,
      entity_type: "tenant",
      entity_id: ctx.tenant.id,
      action: "update",
      after: { fields: Object.keys(parsed.data) },
      reason: "Tenant self-service profile update",
    });

    revalidatePath("/portal/profile");
    return { ok: true, data: { ok: true } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to save profile",
    };
  }
}

export async function updateMyInspectionAction(
  formData: FormData
): Promise<ActionResult<{ ok: true }>> {
  let ctx;
  try {
    ctx = await assertTenantSelf();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Not authorized" };
  }

  const raw = Object.fromEntries(formData.entries());
  const parsed = inspectionUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (!fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields", fieldErrors };
  }

  try {
    const { lease_id, ...patch } = parsed.data;
    await upsertMyInspection({
      tenantId: ctx.tenant.id,
      leaseId: lease_id,
      userId: ctx.session.id,
      patch,
    });

    await logAudit({
      actor_id: ctx.session.id,
      entity_type: "unit_inspection",
      entity_id: lease_id,
      action: "update",
      reason: "Tenant self-service inspection update",
    });

    revalidatePath("/portal/profile/edit");
    return { ok: true, data: { ok: true } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to save inspection",
    };
  }
}
