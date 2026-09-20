"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertPermission } from "@/lib/auth/guard";
import { getSession } from "@/lib/auth/get-session";
import { createLease, updateLease, terminateLease } from "@/lib/db/leases";
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
  const lease = await createLease(parsed.data);
  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "lease",
    entity_id: lease.id,
    action: "create",
    after: lease,
  });
  revalidatePath("/property/leases");
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
