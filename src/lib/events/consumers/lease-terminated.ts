import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function onLeaseTerminated(payload: {
  lease_id: string;
  unit_id: string;
}) {
  const admin = createAdminClient();
  await admin.from("unit").update({ status: "vacant" }).eq("id", payload.unit_id);
}
