import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function onJobOrderCompleted(payload: {
  joborder_id: string;
  unit_id: string;
}) {
  const admin = createAdminClient();
  // Set unit back to vacant so marketing can flip to available
  await admin.from("unit").update({ status: "vacant" }).eq("id", payload.unit_id);
}
