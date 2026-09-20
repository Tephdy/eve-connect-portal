import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { handlers } from "./registry";

export async function dispatchPending(limit = 50): Promise<number> {
  const admin = createAdminClient();
  const { data: events } = await admin
    .from("domain_event")
    .select("id, event_key, payload, retry_count")
    .is("processed_at", null)
    .eq("dead_letter", false)
    .order("emitted_at", { ascending: true })
    .limit(limit);

  if (!events || events.length === 0) return 0;

  let processed = 0;
  for (const evt of events) {
    const handler = (handlers as Record<string, (p: any) => Promise<void>>)[evt.event_key];
    if (!handler) {
      await admin.from("domain_event")
        .update({ processed_at: new Date().toISOString() })
        .eq("id", evt.id);
      processed++;
      continue;
    }
    try {
      await handler(evt.payload);
      await admin.from("domain_event")
        .update({ processed_at: new Date().toISOString() })
        .eq("id", evt.id);
      processed++;
    } catch (err) {
      console.error("[dispatch] failed:", evt.event_key, err);
      const retry = (evt.retry_count ?? 0) + 1;
      await admin.from("domain_event")
        .update({ retry_count: retry, dead_letter: retry >= 3 })
        .eq("id", evt.id);
    }
  }
  return processed;
}
