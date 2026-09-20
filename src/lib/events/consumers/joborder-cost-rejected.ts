import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function onJobOrderCostRejected(payload: {
  joborder_id: string;
  reason: string;
}) {
  const admin = createAdminClient();
  await admin.from("job_order").update({ status: "cancelled" }).eq("id", payload.joborder_id);
  console.log("[joborder.cost_rejected] cancelled:", payload.joborder_id, "reason:", payload.reason);
}
