import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function onJobOrderCreated(payload: {
  joborder_id: string;
  unit_id: string;
  task_type_id: string;
  cost_estimate: number;
}) {
  const admin = createAdminClient();

  const { data: type } = await admin
    .from("job_task_type")
    .select("approval_threshold_php, name")
    .eq("id", payload.task_type_id)
    .single();

  if (!type) return;

  const threshold = Number(type.approval_threshold_php);
  const cost = Number(payload.cost_estimate ?? 0);

  if (cost > threshold) {
    await admin
      .from("job_order")
      .update({ status: "pending_approval" })
      .eq("id", payload.joborder_id);
  }
}
