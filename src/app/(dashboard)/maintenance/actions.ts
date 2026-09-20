"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertPermission } from "@/lib/auth/guard";
import { getSession } from "@/lib/auth/get-session";
import {
  createJobOrder,
  updateJobOrder,
  setJobOrderStatus,
  deleteJobOrder,
} from "@/lib/db/job-orders";
import { createWorkLog } from "@/lib/db/work-logs";
import { createAsset, updateAsset } from "@/lib/db/assets";
import { logAudit } from "@/lib/audit/log";
import { emit } from "@/lib/events/emit";
import {
  jobOrderCreateSchema,
  jobOrderUpdateSchema,
  workLogCreateSchema,
  assetCreateSchema,
  assetUpdateSchema,
} from "@/lib/schemas/job-order";
import { parseForm } from "@/lib/forms/parse";
import type { ActionResult } from "@/lib/actions/result";

// ----- Job Orders -----

export async function createJobOrderAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await assertPermission("joborder:create");
  const parsed = parseForm(jobOrderCreateSchema, formData);
  if (!parsed.ok) return { ok: false, error: parsed.error, fieldErrors: parsed.fieldErrors };

  const session = await getSession();
  const job = await createJobOrder({
    ...parsed.data,
    requested_by_user_id: session?.id ?? null,
  });

  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "job_order",
    entity_id: job.id,
    action: "create",
    after: job,
  });

  await emit(
    "joborder.created",
    {
      joborder_id: job.id,
      unit_id: job.unit_id,
      task_type_id: job.task_type_id,
      cost_estimate: job.cost_estimate ?? 0,
    },
    session?.id ?? null
  );

  revalidatePath("/maintenance");
  revalidatePath("/accounting/approvals");
  redirect("/maintenance/job-orders/" + job.id);
}

export async function updateJobOrderAction(
  id: string,
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await assertPermission("joborder:update");
  const parsed = parseForm(jobOrderUpdateSchema, formData);
  if (!parsed.ok) return { ok: false, error: parsed.error, fieldErrors: parsed.fieldErrors };

  const session = await getSession();
  const updated = await updateJobOrder(id, parsed.data);
  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "job_order",
    entity_id: id,
    action: "update",
    after: updated,
  });

  revalidatePath("/maintenance");
  revalidatePath("/maintenance/job-orders/" + id);
  return { ok: true, data: undefined };
}

export async function completeJobOrderAction(id: string, unit_id: string) {
  await assertPermission("joborder:close");
  const session = await getSession();
  await setJobOrderStatus(id, "done", { closed_at: new Date().toISOString() });
  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "job_order",
    entity_id: id,
    action: "update",
    after: { status: "done" },
  });
  await emit("joborder.completed", { joborder_id: id, unit_id }, session?.id ?? null);
  revalidatePath("/maintenance");
  revalidatePath("/maintenance/job-orders/" + id);
}

export async function startJobOrderAction(id: string) {
  await assertPermission("joborder:update");
  const session = await getSession();
  await setJobOrderStatus(id, "in_progress");
  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "job_order",
    entity_id: id,
    action: "update",
    after: { status: "in_progress" },
  });
  revalidatePath("/maintenance/job-orders/" + id);
}

export async function cancelJobOrderAction(id: string) {
  await assertPermission("joborder:close");
  const session = await getSession();

  await setJobOrderStatus(id, "cancelled", {
    closed_at: new Date().toISOString(),
  });

  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "job_order",
    entity_id: id,
    action: "update",
    after: { status: "cancelled" },
  });

  revalidatePath("/maintenance");
  revalidatePath("/maintenance/job-orders/" + id);
}

export async function deleteJobOrderAction(id: string) {
  await assertPermission("joborder:delete");
  const session = await getSession();

  await deleteJobOrder(id);

  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "job_order",
    entity_id: id,
    action: "delete",
  });

  revalidatePath("/maintenance");
  redirect("/maintenance");
}

// ----- Work Logs -----

export async function createWorkLogAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await assertPermission("worklog:create");
  const parsed = parseForm(workLogCreateSchema, formData);
  if (!parsed.ok) return { ok: false, error: parsed.error, fieldErrors: parsed.fieldErrors };

  const session = await getSession();
  const log = await createWorkLog({
    ...parsed.data,
    technician_user_id: session?.id ?? null,
  });

  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "work_log",
    entity_id: log.id,
    action: "create",
    after: log,
  });

  revalidatePath("/maintenance/job-orders/" + log.job_order_id);
  return { ok: true, data: undefined };
}

// ----- Assets -----

export async function createAssetAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await assertPermission("asset:create");
  const parsed = parseForm(assetCreateSchema, formData);
  if (!parsed.ok) return { ok: false, error: parsed.error, fieldErrors: parsed.fieldErrors };
  const session = await getSession();
  const asset = await createAsset(parsed.data);
  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "asset",
    entity_id: asset.id,
    action: "create",
    after: asset,
  });
  revalidatePath("/maintenance/assets");
  redirect("/maintenance/assets/" + asset.id);
}

export async function updateAssetAction(
  id: string,
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await assertPermission("asset:update");
  const parsed = parseForm(assetUpdateSchema, formData);
  if (!parsed.ok) return { ok: false, error: parsed.error, fieldErrors: parsed.fieldErrors };
  const session = await getSession();
  const updated = await updateAsset(id, parsed.data);
  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "asset",
    entity_id: id,
    action: "update",
    after: updated,
  });
  revalidatePath("/maintenance/assets");
  revalidatePath("/maintenance/assets/" + id);
  return { ok: true, data: undefined };
}