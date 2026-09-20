import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { JobOrderCreateInput, JobOrderUpdateInput } from "@/lib/schemas/job-order";

export type JobOrder = {
  id: string;
  unit_id: string;
  task_type_id: string;
  requested_by_user_id: string | null;
  priority: "low" | "normal" | "high" | "urgent";
  description: string | null;
  status: "open" | "pending_approval" | "assigned" | "in_progress" | "done" | "cancelled";
  cost_estimate: number | null;
  assigned_to: string | null;
  created_at: string;
  closed_at: string | null;
  unit_number?: string;
  property_name?: string;
  task_type_name?: string;
};

const JOB_ORDER_SELECT =
  "id, unit_id, task_type_id, requested_by_user_id, priority, description, status, cost_estimate, assigned_to, created_at, closed_at";

// -----------------------------------------------------------------------------
// Read helpers (anon client, reads go through public.job_order view)
// -----------------------------------------------------------------------------

async function enrich(rows: JobOrder[]): Promise<JobOrder[]> {
  if (rows.length === 0) return rows;
  const supabase = await createClient();
  const unitIds = Array.from(new Set(rows.map((r) => r.unit_id)));
  const typeIds = Array.from(new Set(rows.map((r) => r.task_type_id)));

  const [{ data: units }, { data: types }] = await Promise.all([
    supabase.from("unit").select("id, unit_number, property_id").in("id", unitIds),
    supabase.from("job_task_type").select("id, name").in("id", typeIds),
  ]);

  const propIds = Array.from(new Set((units ?? []).map((u: any) => u.property_id)));
  const { data: props } = propIds.length > 0
    ? await supabase.from("property").select("id, name").in("id", propIds)
    : { data: [] as { id: string; name: string }[] };

  const uMap = new Map((units ?? []).map((u: any) => [u.id, u]));
  const tMap = new Map((types ?? []).map((t) => [t.id, t.name]));
  const pMap = new Map((props ?? []).map((p) => [p.id, p.name]));

  rows.forEach((r) => {
    const u = uMap.get(r.unit_id) as any;
    r.unit_number = u?.unit_number;
    r.property_name = u ? pMap.get(u.property_id) : undefined;
    r.task_type_name = tMap.get(r.task_type_id);
  });
  return rows;
}

export async function listJobOrders(): Promise<JobOrder[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_order")
    .select(JOB_ORDER_SELECT)
    .neq("status", "cancelled")   // hide cancelled by default
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return enrich((data ?? []) as JobOrder[]);
}

export async function listPendingApprovals(): Promise<JobOrder[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_order")
    .select(JOB_ORDER_SELECT)
    .eq("status", "pending_approval")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return enrich((data ?? []) as JobOrder[]);
}

export async function getJobOrder(id: string): Promise<JobOrder | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_order")
    .select(JOB_ORDER_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const [enriched] = await enrich([data as JobOrder]);
  return enriched;
}

// -----------------------------------------------------------------------------
// Write helpers — admin client writes DIRECTLY to maint.job_order
// (bypasses public view + RLS; permission enforced at service layer)
// -----------------------------------------------------------------------------

function logWriteError(fn: string, error: any) {
  console.error(`\n=== [${fn}] ERROR ===`);
  console.error(JSON.stringify(error, null, 2));
  console.error(`code: ${error?.code}`);
  console.error(`message: ${error?.message}`);
  console.error(`details: ${error?.details}`);
  console.error(`hint: ${error?.hint}`);
  console.error(`=== END [${fn}] ===\n`);
}

export async function createJobOrder(
  input: JobOrderCreateInput & { requested_by_user_id: string | null }
): Promise<JobOrder> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .schema("maint")
    .from("job_order")
    .insert({
      unit_id: input.unit_id,
      task_type_id: input.task_type_id,
      requested_by_user_id: input.requested_by_user_id,
      priority: input.priority,
      description: input.description,
      status: input.status,
      cost_estimate: input.cost_estimate,
    })
    .select(JOB_ORDER_SELECT)
    .single();

  if (error) {
  logWriteError("createJobOrder", error);
  throw new Error(`${error.message}${error.hint ? " — " + error.hint : ""}`);
}
  return data as JobOrder;
}

export async function updateJobOrder(id: string, input: JobOrderUpdateInput): Promise<JobOrder> {
  const admin = createAdminClient();
  const patch: Record<string, unknown> = {};
  const fields = ["unit_id", "task_type_id", "priority", "description", "status", "cost_estimate"] as const;
  for (const f of fields) {
    if (input[f] !== undefined) patch[f] = input[f];
  }

  const { data, error } = await admin
    .schema("maint")
    .from("job_order")
    .update(patch)
    .eq("id", id)
    .select(JOB_ORDER_SELECT)
    .single();

  if (error) {
    logWriteError("updateJobOrder", error);
    throw new Error(error.message);
  }
  return data as JobOrder;
}

export async function setJobOrderStatus(
  id: string,
  status: JobOrder["status"],
  extras?: { assigned_to?: string | null; closed_at?: string | null }
): Promise<void> {
  const admin = createAdminClient();
  const patch: Record<string, unknown> = { status };
  if (extras?.assigned_to !== undefined) patch.assigned_to = extras.assigned_to;
  if (extras?.closed_at !== undefined) patch.closed_at = extras.closed_at;

  const { error } = await admin
    .schema("maint")
    .from("job_order")
    .update(patch)
    .eq("id", id);

  if (error) {
    logWriteError("setJobOrderStatus", error);
    throw new Error(error.message);
  }
}

export async function deleteJobOrder(id: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("job_order").delete().eq("id", id);
  if (error) {
    logWriteError("deleteJobOrder", error);
    throw new Error(error.message);
  }
}