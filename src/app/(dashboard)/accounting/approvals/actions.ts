"use server";

import { revalidatePath } from "next/cache";
import { assertPermission } from "@/lib/auth/guard";
import { getSession } from "@/lib/auth/get-session";
import { setJobOrderStatus } from "@/lib/db/job-orders";
import { emit } from "@/lib/events/emit";
import { logAudit } from "@/lib/audit/log";

export async function approveJobOrderAction(joborder_id: string) {
  await assertPermission("invoice:create");
  const session = await getSession();

  await setJobOrderStatus(joborder_id, "assigned");
  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "job_order",
    entity_id: joborder_id,
    action: "update",
    after: { status: "assigned" },
  });
  await emit("joborder.cost_approved", { joborder_id }, session?.id ?? null);

  revalidatePath("/accounting/approvals");
  revalidatePath("/maintenance");
}

export async function rejectJobOrderAction(joborder_id: string, reason: string) {
  await assertPermission("invoice:create");
  const session = await getSession();

  await setJobOrderStatus(joborder_id, "cancelled");
  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "job_order",
    entity_id: joborder_id,
    action: "update",
    after: { status: "cancelled", reason },
  });
  await emit("joborder.cost_rejected", { joborder_id, reason }, session?.id ?? null);

  revalidatePath("/accounting/approvals");
  revalidatePath("/maintenance");
}
