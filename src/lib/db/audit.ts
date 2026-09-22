import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  AuditComment,
  AuditFinding,
  AuditRule,
  FindingStatus,
  Severity,
} from "@/lib/audit/types";

export async function listRules(): Promise<AuditRule[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.schema("acct")
    .from("audit_rule").select("*")
    .order("severity", { ascending: false })
    .order("key");
  if (error) throw new Error(error.message);
  return (data ?? []) as AuditRule[];
}

export async function updateRule(
  key: string,
  patch: { enabled?: boolean; severity?: Severity; threshold?: Record<string, unknown> }
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .schema("acct").from("audit_rule")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("key", key);
  if (error) throw new Error(error.message);
}

export type FindingFilter = {
  status?: FindingStatus | "all";
  severity?: Severity | "all";
  rule_key?: string | "all";
};

export async function listFindings(filter: FindingFilter = {}): Promise<AuditFinding[]> {
  const supabase = await createClient();
  let q = supabase.schema("acct").from("audit_finding").select("*")
    .order("detected_at", { ascending: false }).limit(500);

  if (filter.status && filter.status !== "all") q = q.eq("status", filter.status);
  if (filter.severity && filter.severity !== "all") q = q.eq("severity", filter.severity);
  if (filter.rule_key && filter.rule_key !== "all") q = q.eq("rule_key", filter.rule_key);

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const rules = await listRules();
  const ruleMap = new Map(rules.map((r) => [r.key, r.name]));
  return (data ?? []).map((f: any) => ({
    ...f,
    rule_name: ruleMap.get(f.rule_key) ?? f.rule_key,
  })) as AuditFinding[];
}

export async function getFinding(id: string): Promise<AuditFinding | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.schema("acct")
    .from("audit_finding").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const rules = await listRules();
  const ruleMap = new Map(rules.map((r) => [r.key, r.name]));
  return { ...(data as any), rule_name: ruleMap.get((data as any).rule_key) } as AuditFinding;
}

export async function updateFinding(
  id: string,
  patch: {
    status?: FindingStatus;
    assigned_to?: string | null;
    resolution?: string | null;
    resolved_at?: string | null;
    resolved_by?: string | null;
  }
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .schema("acct").from("audit_finding").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listComments(finding_id: string): Promise<AuditComment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.schema("acct")
    .from("audit_comment").select("*").eq("finding_id", finding_id)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  const comments = (data ?? []) as AuditComment[];
  const authorIds = Array.from(new Set(comments.map((c) => c.author_id).filter(Boolean))) as string[];
  if (authorIds.length > 0) {
    const { data: users } = await supabase.from("app_user")
      .select("id, email").in("id", authorIds);
    const map = new Map((users ?? []).map((u: any) => [u.id, u.email]));
    comments.forEach((c) => {
      c.author_email = c.author_id ? map.get(c.author_id) ?? null : null;
    });
  }
  return comments;
}

export async function addComment(finding_id: string, author_id: string | null, body: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .schema("acct").from("audit_comment")
    .insert({ finding_id, author_id, body });
  if (error) throw new Error(error.message);
}

export async function getAuditStats(): Promise<{
  total_open: number;
  by_severity: Record<Severity, number>;
  by_status: Record<FindingStatus, number>;
  health_score: number;
}> {
  const supabase = await createClient();
  const { data } = await supabase.schema("acct").from("audit_finding").select("severity, status");

  const by_severity: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  const by_status: Record<FindingStatus, number> = { open: 0, investigating: 0, resolved: 0, dismissed: 0 };
  let total_open = 0;

  for (const f of (data ?? []) as any[]) {
    by_severity[f.severity as Severity]++;
    by_status[f.status as FindingStatus]++;
    if (f.status === "open" || f.status === "investigating") total_open++;
  }

  const weight = { critical: 25, high: 10, medium: 4, low: 1 } as const;
  const penalty =
    by_severity.critical * weight.critical +
    by_severity.high * weight.high +
    by_severity.medium * weight.medium +
    by_severity.low * weight.low;
  const health_score = Math.max(0, Math.min(100, 100 - penalty));

  return { total_open, by_severity, by_status, health_score };
}
