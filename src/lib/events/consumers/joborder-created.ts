import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function onJobOrderCreated(payload: {
  joborder_id: string;
  unit_id: string;
  task_type_id: string;
  cost_estimate: number;
}) {
  const admin = createAdminClient();

  // Look up the task-type threshold
  const { data: type } = await admin
    .from("job_task_type")
    .select("approval_threshold_php, name")
    .eq("id", payload.task_type_id)
    .single();

  if (!type) {
    console.error("[joborder.created] task type not found:", payload.task_type_id);
    return;
  }

  const threshold = Number(type.approval_threshold_php);
  const cost = Number(payload.cost_estimate ?? 0);

  if (cost > threshold) {
    // Set to pending approval
    await admin
      .from("job_order")
      .update({ status: "pending_approval" })
      .eq("id", payload.joborder_id);
    console.log(
      "[joborder.created] pending accounting approval:",
      payload.joborder_id,
      "cost", cost, "> threshold", threshold
    );
  } else {
    console.log("[joborder.created] auto-approved (cost within threshold)");
  }
}
