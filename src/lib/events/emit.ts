import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function emit(
  key: string,
  payload: Record<string, unknown>,
  actorId: string | null
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("domain_event").insert({
    event_key: key,
    payload,
    emitted_by_user_id: actorId,
  });
  if (error) {
    console.error("[emit] failed:", key, error);
    throw error;
  }
}