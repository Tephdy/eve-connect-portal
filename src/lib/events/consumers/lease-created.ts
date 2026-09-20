import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function onLeaseCreated(payload: {
  lease_id: string;
  unit_id: string;
  tenant_id: string;
}) {
  const admin = createAdminClient();
  // Mark unit as reserved when a lease is created
  await admin.from("unit").update({ status: "reserved" }).eq("id", payload.unit_id);
}
