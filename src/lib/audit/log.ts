import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

type AuditParams = {
  entity_type: string;
  entity_id: string;
  action: "create" | "update" | "delete" | "archive";
  before?: unknown;
  after?: unknown;
  reason?: string;
  actor_id: string | null;
};

export async function logAudit(params: AuditParams) {
  const admin = createAdminClient();
  const { error } = await admin.from("audit_log").insert({
    actor_user_id: params.actor_id,
    entity_type: params.entity_type,
    entity_id: params.entity_id,
    action: params.action,
    before: params.before ?? null,
    after: params.after ?? null,
    reason: params.reason ?? null,
  });
  if (error) {
    console.error("[logAudit] failed:", error);
    // Don't throw — audit failure shouldn't break the main flow
  }
}