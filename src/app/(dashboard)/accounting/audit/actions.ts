"use server";

import { revalidatePath } from "next/cache";
import { assertPermission } from "@/lib/auth/guard";
import { getSession } from "@/lib/auth/get-session";
import { updateFinding, addComment, updateRule } from "@/lib/db/audit";
import { runAudit } from "@/lib/audit/engine";
import { logAudit } from "@/lib/audit/log";
import type { FindingStatus, Severity } from "@/lib/audit/types";
import type { ActionResult } from "@/lib/actions/result";

export async function runAuditAction(): Promise<ActionResult<{ new_findings: number; violations_found: number; auto_closed: number }>> {
  await assertPermission("audit:manage");
  const session = await getSession();
  try {
    const result = await runAudit();
    await logAudit({
      actor_id: session?.id ?? null,
      entity_type: "audit_run",
      entity_id: "00000000-0000-0000-0000-000000000000",
      action: "create",
      after: {
        new_findings: result.new_findings,
        violations_found: result.violations_found,
        auto_closed: result.auto_closed,
        errors: result.errors,
      },
    });
    revalidatePath("/accounting/audit");
    revalidatePath("/accounting/audit/findings");
    return {
      ok: true,
      data: {
        new_findings: result.new_findings,
        violations_found: result.violations_found,
        auto_closed: result.auto_closed,
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Audit failed" };
  }
}

export async function setFindingStatusAction(
  id: string,
  status: FindingStatus,
  resolution?: string
): Promise<ActionResult> {
  await assertPermission("audit:manage");
  const session = await getSession();
  const patch: Record<string, unknown> = { status };
  if (status === "resolved" || status === "dismissed") {
    patch.resolved_at = new Date().toISOString();
    patch.resolved_by = session?.id ?? null;
    patch.resolution = resolution ?? null;
    patch.auto_closed = false;
  } else {
    patch.resolved_at = null;
    patch.resolved_by = null;
    patch.resolution = null;
  }
  await updateFinding(id, patch as any);
  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "audit_finding",
    entity_id: id,
    action: "update",
    after: { status, resolution: resolution ?? null },
  });
  revalidatePath("/accounting/audit/findings");
  revalidatePath("/accounting/audit/findings/" + id);
  return { ok: true, data: undefined };
}

export async function assignFindingAction(id: string, user_id: string | null): Promise<ActionResult> {
  await assertPermission("audit:manage");
  const session = await getSession();
  await updateFinding(id, { assigned_to: user_id });
  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "audit_finding",
    entity_id: id,
    action: "update",
    after: { assigned_to: user_id },
  });
  revalidatePath("/accounting/audit/findings/" + id);
  return { ok: true, data: undefined };
}

export async function commentFindingAction(id: string, body: string): Promise<ActionResult> {
  await assertPermission("audit:read");
  const session = await getSession();
  if (!body.trim()) return { ok: false, error: "Comment cannot be empty" };
  await addComment(id, session?.id ?? null, body.trim());
  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "audit_finding",
    entity_id: id,
    action: "update",
    after: { comment: body.trim() },
  });
  revalidatePath("/accounting/audit/findings/" + id);
  return { ok: true, data: undefined };
}

export async function updateRuleAction(
  key: string,
  patch: { enabled?: boolean; severity?: Severity; threshold?: Record<string, unknown> }
): Promise<ActionResult> {
  await assertPermission("audit:manage");
  const session = await getSession();
  await updateRule(key, patch);
  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "audit_rule",
    entity_id: "00000000-0000-0000-0000-000000000000",
    action: "update",
    after: { key, ...patch },
  });
  revalidatePath("/accounting/audit/rules");
  return { ok: true, data: undefined };
}
