import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function onJobOrderCostApproved(payload: { joborder_id: string }) {
  const admin = createAdminClient();
  await admin.from("job_order").update({ status: "assigned" }).eq("id", payload.joborder_id);
  console.log("[joborder.cost_approved] moved to assigned:", payload.joborder_id);
}
