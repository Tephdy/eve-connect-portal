#!/usr/bin/env node
/**
 * Phase 2 - Maintenance module
 * Usage: node scaffold-phase2.mjs
 */

import { mkdir, writeFile, access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { join, dirname } from "node:path";

const ROOT = process.cwd();
const FILES = {};

async function exists(p) {
  try { await access(p, constants.F_OK); return true; } catch { return false; }
}

// =============================================================================
// SCHEMAS
// =============================================================================

FILES["src/lib/schemas/job-order.ts"] =
`import { z } from "zod";

export const jobPriorities = ["low","normal","high","urgent"] as const;
export const jobStatuses = ["open","pending_approval","assigned","in_progress","done","cancelled"] as const;

export const jobOrderCreateSchema = z.object({
  unit_id: z.string().uuid("Unit is required"),
  task_type_id: z.string().uuid("Task type is required"),
  priority: z.enum(jobPriorities).default("normal"),
  description: z.string().min(5, "Description is too short").max(2000),
  cost_estimate: z.coerce.number().min(0).default(0),
  status: z.enum(jobStatuses).default("open"),
});

export const jobOrderUpdateSchema = jobOrderCreateSchema.partial();

export const workLogCreateSchema = z.object({
  job_order_id: z.string().uuid(),
  notes: z.string().min(1, "Notes required").max(2000),
  hours: z.coerce.number().min(0).optional(),
  parts_used: z.string().max(2000).optional().or(z.literal("")),
});

export const assetCreateSchema = z.object({
  unit_id: z.string().uuid("Unit is required"),
  name: z.string().min(1, "Name is required").max(200),
  type: z.string().max(100).optional().or(z.literal("")),
  install_date: z.string().optional().or(z.literal("")),
  warranty_until: z.string().optional().or(z.literal("")),
});

export const assetUpdateSchema = assetCreateSchema.partial();

export type JobOrderCreateInput = z.infer<typeof jobOrderCreateSchema>;
export type JobOrderUpdateInput = z.infer<typeof jobOrderUpdateSchema>;
export type WorkLogCreateInput = z.infer<typeof workLogCreateSchema>;
export type AssetCreateInput = z.infer<typeof assetCreateSchema>;
export type AssetUpdateInput = z.infer<typeof assetUpdateSchema>;
`;

// =============================================================================
// DB: task types
// =============================================================================

FILES["src/lib/db/job-task-types.ts"] =
`import "server-only";
import { createClient } from "@/lib/supabase/server";

export type JobTaskType = {
  id: string;
  key: string;
  name: string;
  approval_threshold_php: number;
};

export async function listTaskTypes(): Promise<JobTaskType[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_task_type")
    .select("id, key, name, approval_threshold_php")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as JobTaskType[];
}

export async function updateTaskType(
  id: string,
  threshold: number
): Promise<JobTaskType> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_task_type")
    .update({ approval_threshold_php: threshold })
    .eq("id", id)
    .select("id, key, name, approval_threshold_php")
    .single();
  if (error) throw new Error(error.message);
  return data as JobTaskType;
}
`;

// =============================================================================
// DB: job orders
// =============================================================================

FILES["src/lib/db/job-orders.ts"] =
`import "server-only";
import { createClient } from "@/lib/supabase/server";
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
    .select("id, unit_id, task_type_id, requested_by_user_id, priority, description, status, cost_estimate, assigned_to, created_at, closed_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return enrich((data ?? []) as JobOrder[]);
}

export async function listPendingApprovals(): Promise<JobOrder[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_order")
    .select("id, unit_id, task_type_id, requested_by_user_id, priority, description, status, cost_estimate, assigned_to, created_at, closed_at")
    .eq("status", "pending_approval")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return enrich((data ?? []) as JobOrder[]);
}

export async function getJobOrder(id: string): Promise<JobOrder | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_order")
    .select("id, unit_id, task_type_id, requested_by_user_id, priority, description, status, cost_estimate, assigned_to, created_at, closed_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const [enriched] = await enrich([data as JobOrder]);
  return enriched;
}

export async function createJobOrder(input: JobOrderCreateInput & { requested_by_user_id: string | null }): Promise<JobOrder> {
  const supabase = await createClient();
  const { data, error } = await supabase
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
    .select("id, unit_id, task_type_id, requested_by_user_id, priority, description, status, cost_estimate, assigned_to, created_at, closed_at")
    .single();
  if (error) throw new Error(error.message);
  return data as JobOrder;
}

export async function updateJobOrder(id: string, input: JobOrderUpdateInput): Promise<JobOrder> {
  const supabase = await createClient();
  const patch: Record<string, unknown> = {};
  const fields = ["unit_id","task_type_id","priority","description","status","cost_estimate"] as const;
  for (const f of fields) {
    if (input[f] !== undefined) patch[f] = input[f];
  }
  const { data, error } = await supabase
    .from("job_order")
    .update(patch).eq("id", id)
    .select("id, unit_id, task_type_id, requested_by_user_id, priority, description, status, cost_estimate, assigned_to, created_at, closed_at")
    .single();
  if (error) throw new Error(error.message);
  return data as JobOrder;
}

export async function setJobOrderStatus(
  id: string,
  status: JobOrder["status"],
  extras?: { assigned_to?: string | null; closed_at?: string | null }
): Promise<void> {
  const supabase = await createClient();
  const patch: Record<string, unknown> = { status };
  if (extras?.assigned_to !== undefined) patch.assigned_to = extras.assigned_to;
  if (extras?.closed_at !== undefined) patch.closed_at = extras.closed_at;
  const { error } = await supabase.from("job_order").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}
`;

// =============================================================================
// DB: work logs
// =============================================================================

FILES["src/lib/db/work-logs.ts"] =
`import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { WorkLogCreateInput } from "@/lib/schemas/job-order";

export type WorkLog = {
  id: string;
  job_order_id: string;
  technician_user_id: string | null;
  notes: string | null;
  hours: number | null;
  parts_used: unknown;
  completed_at: string | null;
};

export async function listWorkLogs(job_order_id: string): Promise<WorkLog[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("work_log")
    .select("id, job_order_id, technician_user_id, notes, hours, parts_used, completed_at")
    .eq("job_order_id", job_order_id)
    .order("completed_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as WorkLog[];
}

export async function createWorkLog(
  input: WorkLogCreateInput & { technician_user_id: string | null }
): Promise<WorkLog> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("work_log")
    .insert({
      job_order_id: input.job_order_id,
      technician_user_id: input.technician_user_id,
      notes: input.notes,
      hours: input.hours ?? null,
      parts_used: input.parts_used ? [{ text: input.parts_used }] : [],
      completed_at: new Date().toISOString(),
    })
    .select("id, job_order_id, technician_user_id, notes, hours, parts_used, completed_at")
    .single();
  if (error) throw new Error(error.message);
  return data as WorkLog;
}
`;

// =============================================================================
// DB: assets
// =============================================================================

FILES["src/lib/db/assets.ts"] =
`import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AssetCreateInput, AssetUpdateInput } from "@/lib/schemas/job-order";

export type Asset = {
  id: string;
  unit_id: string;
  name: string;
  type: string | null;
  install_date: string | null;
  warranty_until: string | null;
  unit_number?: string;
};

async function enrich(rows: Asset[]): Promise<Asset[]> {
  if (rows.length === 0) return rows;
  const supabase = await createClient();
  const ids = Array.from(new Set(rows.map((r) => r.unit_id)));
  const { data: units } = await supabase.from("unit").select("id, unit_number").in("id", ids);
  const uMap = new Map((units ?? []).map((u) => [u.id, u.unit_number]));
  rows.forEach((r) => { r.unit_number = uMap.get(r.unit_id); });
  return rows;
}

export async function listAssets(): Promise<Asset[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("asset")
    .select("id, unit_id, name, type, install_date, warranty_until")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return enrich((data ?? []) as Asset[]);
}

export async function getAsset(id: string): Promise<Asset | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("asset")
    .select("id, unit_id, name, type, install_date, warranty_until")
    .eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const [e] = await enrich([data as Asset]);
  return e;
}

export async function createAsset(input: AssetCreateInput): Promise<Asset> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("asset")
    .insert({
      unit_id: input.unit_id,
      name: input.name,
      type: input.type || null,
      install_date: input.install_date || null,
      warranty_until: input.warranty_until || null,
    })
    .select("id, unit_id, name, type, install_date, warranty_until")
    .single();
  if (error) throw new Error(error.message);
  return data as Asset;
}

export async function updateAsset(id: string, input: AssetUpdateInput): Promise<Asset> {
  const supabase = await createClient();
  const patch: Record<string, unknown> = {};
  if (input.unit_id !== undefined) patch.unit_id = input.unit_id;
  if (input.name !== undefined) patch.name = input.name;
  if (input.type !== undefined) patch.type = input.type || null;
  if (input.install_date !== undefined) patch.install_date = input.install_date || null;
  if (input.warranty_until !== undefined) patch.warranty_until = input.warranty_until || null;
  const { data, error } = await supabase
    .from("asset").update(patch).eq("id", id)
    .select("id, unit_id, name, type, install_date, warranty_until")
    .single();
  if (error) throw new Error(error.message);
  return data as Asset;
}
`;

// =============================================================================
// EVENTS — extend registry with maintenance consumers
// =============================================================================

FILES["src/lib/events/consumers/joborder-created.ts"] =
`import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function onJobOrderCreated(payload: {
  joborder_id: string;
  unit_id: string;
  task_type_id: string;
  cost_estimate: number;
}) {
  const admin = createAdminClient();

  // Look up the task-type threshold
  const { data: type } = await admin
    .from("job_task_type")
    .select("approval_threshold_php, name")
    .eq("id", payload.task_type_id)
    .single();

  if (!type) {
    console.error("[joborder.created] task type not found:", payload.task_type_id);
    return;
  }

  const threshold = Number(type.approval_threshold_php);
  const cost = Number(payload.cost_estimate ?? 0);

  if (cost > threshold) {
    // Set to pending approval
    await admin
      .from("job_order")
      .update({ status: "pending_approval" })
      .eq("id", payload.joborder_id);
    console.log(
      "[joborder.created] pending accounting approval:",
      payload.joborder_id,
      "cost", cost, "> threshold", threshold
    );
  } else {
    console.log("[joborder.created] auto-approved (cost within threshold)");
  }
}
`;

FILES["src/lib/events/consumers/joborder-cost-approved.ts"] =
`import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function onJobOrderCostApproved(payload: { joborder_id: string }) {
  const admin = createAdminClient();
  await admin.from("job_order").update({ status: "assigned" }).eq("id", payload.joborder_id);
  console.log("[joborder.cost_approved] moved to assigned:", payload.joborder_id);
}
`;

FILES["src/lib/events/consumers/joborder-cost-rejected.ts"] =
`import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function onJobOrderCostRejected(payload: {
  joborder_id: string;
  reason: string;
}) {
  const admin = createAdminClient();
  await admin.from("job_order").update({ status: "cancelled" }).eq("id", payload.joborder_id);
  console.log("[joborder.cost_rejected] cancelled:", payload.joborder_id, "reason:", payload.reason);
}
`;

FILES["src/lib/events/consumers/joborder-completed.ts"] =
`import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function onJobOrderCompleted(payload: {
  joborder_id: string;
  unit_id: string;
}) {
  const admin = createAdminClient();
  // Set unit back to vacant so marketing can flip to available
  await admin.from("unit").update({ status: "vacant" }).eq("id", payload.unit_id);
  console.log("[joborder.completed] unit available:", payload.unit_id);
}
`;

FILES["src/lib/events/registry.ts"] =
`import { onLeaseSigned } from "./consumers/lease-signed";
import { onLeaseCreated } from "./consumers/lease-created";
import { onLeaseTerminated } from "./consumers/lease-terminated";
import { onTenantCreated } from "./consumers/tenant-created";
import { onJobOrderCreated } from "./consumers/joborder-created";
import { onJobOrderCostApproved } from "./consumers/joborder-cost-approved";
import { onJobOrderCostRejected } from "./consumers/joborder-cost-rejected";
import { onJobOrderCompleted } from "./consumers/joborder-completed";

export const handlers: Record<string, (payload: any) => Promise<void>> = {
  "tenant.created": onTenantCreated,
  "lease.created": onLeaseCreated,
  "lease.signed": onLeaseSigned,
  "lease.terminated": onLeaseTerminated,
  "joborder.created": onJobOrderCreated,
  "joborder.cost_approved": onJobOrderCostApproved,
  "joborder.cost_rejected": onJobOrderCostRejected,
  "joborder.completed": onJobOrderCompleted,
};
`;

// =============================================================================
// MAINTENANCE — Pages
// =============================================================================

FILES["src/app/(dashboard)/maintenance/page.tsx"] =
`import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/guard";
import { listJobOrders } from "@/lib/db/job-orders";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { JobOrderTable } from "@/components/maintenance/job-order-table";

export default async function MaintenanceHome() {
  await requirePagePermission("joborder:read");
  const jobs = await listJobOrders();

  return (
    <div>
      <PageHeader
        title="Maintenance"
        description="Job orders, work logs, and assets."
        action={<Link href="/maintenance/job-orders/new"><Button>+ New Job Order</Button></Link>}
      />

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500">Open</p>
          <p className="text-2xl font-semibold">{jobs.filter((j) => j.status === "open").length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500">Pending approval</p>
          <p className="text-2xl font-semibold text-yellow-600">
            {jobs.filter((j) => j.status === "pending_approval").length}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500">In progress</p>
          <p className="text-2xl font-semibold text-blue-600">
            {jobs.filter((j) => j.status === "in_progress" || j.status === "assigned").length}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500">Done</p>
          <p className="text-2xl font-semibold text-green-600">
            {jobs.filter((j) => j.status === "done").length}
          </p>
        </div>
      </div>

      {jobs.length === 0 ? (
        <EmptyState
          title="No job orders yet"
          description="Create your first job order."
          action={<Link href="/maintenance/job-orders/new"><Button>+ New Job Order</Button></Link>}
        />
      ) : (
        <JobOrderTable jobs={jobs} />
      )}
    </div>
  );
}
`;

FILES["src/app/(dashboard)/maintenance/job-orders/new/page.tsx"] =
`import { requirePagePermission } from "@/lib/auth/guard";
import { listUnits } from "@/lib/db/units";
import { listTaskTypes } from "@/lib/db/job-task-types";
import { PageHeader } from "@/components/layout/page-header";
import { JobOrderForm } from "@/components/maintenance/job-order-form";

export default async function NewJobOrderPage() {
  await requirePagePermission("joborder:create");
  const [units, types] = await Promise.all([listUnits(), listTaskTypes()]);
  return (
    <div>
      <PageHeader title="New Job Order" description="Log a maintenance request." />
      <JobOrderForm mode="create" units={units} taskTypes={types} />
    </div>
  );
}
`;

FILES["src/app/(dashboard)/maintenance/job-orders/[id]/page.tsx"] =
`import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/guard";
import { getJobOrder } from "@/lib/db/job-orders";
import { listWorkLogs } from "@/lib/db/work-logs";
import { listUnits } from "@/lib/db/units";
import { listTaskTypes } from "@/lib/db/job-task-types";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { JobOrderForm } from "@/components/maintenance/job-order-form";
import { WorkLogPanel } from "@/components/maintenance/work-log-panel";
import { JobOrderActions } from "@/components/maintenance/job-order-actions";
import { formatPHP } from "@/lib/utils/format-php";

const STATUS_TONE: Record<string, "gray" | "yellow" | "blue" | "green" | "red"> = {
  open: "gray",
  pending_approval: "yellow",
  assigned: "blue",
  in_progress: "blue",
  done: "green",
  cancelled: "red",
};

export default async function JobOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("joborder:read");
  const { id } = await params;
  const job = await getJobOrder(id);
  if (!job) notFound();

  const [units, types, logs] = await Promise.all([
    listUnits(),
    listTaskTypes(),
    listWorkLogs(job.id),
  ]);

  return (
    <div>
      <PageHeader
        title={"Job Order #" + job.id.slice(0, 8)}
        description={
          (job.unit_number ? "Unit " + job.unit_number : "") +
          (job.property_name ? " — " + job.property_name : "")
        }
        action={<Badge tone={STATUS_TONE[job.status] ?? "gray"}>{job.status}</Badge>}
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <JobOrderForm mode="edit" job={job} units={units} taskTypes={types} />
          <WorkLogPanel jobOrderId={job.id} logs={logs} />
        </div>
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg p-5 text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500">Task type</span>
              <span className="font-medium">{job.task_type_name ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Cost estimate</span>
              <span className="font-medium">
                {job.cost_estimate != null ? formatPHP(job.cost_estimate) : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Priority</span>
              <span className="font-medium capitalize">{job.priority}</span>
            </div>
          </div>
          <JobOrderActions job={job} />
        </div>
      </div>
    </div>
  );
}
`;

// =============================================================================
// MAINTENANCE — Actions
// =============================================================================

FILES["src/app/(dashboard)/maintenance/actions.ts"] =
`"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertPermission } from "@/lib/auth/guard";
import { getSession } from "@/lib/auth/get-session";
import {
  createJobOrder,
  updateJobOrder,
  setJobOrderStatus,
} from "@/lib/db/job-orders";
import { createWorkLog } from "@/lib/db/work-logs";
import { createAsset, updateAsset } from "@/lib/db/assets";
import { logAudit } from "@/lib/audit/log";
import { emit } from "@/lib/events/emit";
import {
  jobOrderCreateSchema,
  jobOrderUpdateSchema,
  workLogCreateSchema,
  assetCreateSchema,
  assetUpdateSchema,
} from "@/lib/schemas/job-order";
import { parseForm } from "@/lib/forms/parse";
import type { ActionResult } from "@/lib/actions/result";

// ----- Job Orders -----

export async function createJobOrderAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await assertPermission("joborder:create");
  const parsed = parseForm(jobOrderCreateSchema, formData);
  if (!parsed.ok) return { ok: false, error: parsed.error, fieldErrors: parsed.fieldErrors };

  const session = await getSession();
  const job = await createJobOrder({
    ...parsed.data,
    requested_by_user_id: session?.id ?? null,
  });

  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "job_order",
    entity_id: job.id,
    action: "create",
    after: job,
  });

  // Emit event — threshold check happens in the consumer
  await emit(
    "joborder.created",
    {
      joborder_id: job.id,
      unit_id: job.unit_id,
      task_type_id: job.task_type_id,
      cost_estimate: job.cost_estimate ?? 0,
    },
    session?.id ?? null
  );

  revalidatePath("/maintenance");
  revalidatePath("/accounting/approvals");
  redirect("/maintenance/job-orders/" + job.id);
}

export async function updateJobOrderAction(
  id: string,
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await assertPermission("joborder:update");
  const parsed = parseForm(jobOrderUpdateSchema, formData);
  if (!parsed.ok) return { ok: false, error: parsed.error, fieldErrors: parsed.fieldErrors };

  const session = await getSession();
  const updated = await updateJobOrder(id, parsed.data);
  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "job_order",
    entity_id: id,
    action: "update",
    after: updated,
  });

  revalidatePath("/maintenance");
  revalidatePath("/maintenance/job-orders/" + id);
  return { ok: true, data: undefined };
}

export async function completeJobOrderAction(id: string, unit_id: string) {
  await assertPermission("joborder:close");
  const session = await getSession();
  await setJobOrderStatus(id, "done", { closed_at: new Date().toISOString() });
  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "job_order",
    entity_id: id,
    action: "update",
    after: { status: "done" },
  });
  await emit("joborder.completed", { joborder_id: id, unit_id }, session?.id ?? null);
  revalidatePath("/maintenance");
  revalidatePath("/maintenance/job-orders/" + id);
}

export async function startJobOrderAction(id: string) {
  await assertPermission("joborder:update");
  const session = await getSession();
  await setJobOrderStatus(id, "in_progress");
  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "job_order",
    entity_id: id,
    action: "update",
    after: { status: "in_progress" },
  });
  revalidatePath("/maintenance/job-orders/" + id);
}

// ----- Work Logs -----

export async function createWorkLogAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await assertPermission("worklog:create");
  const parsed = parseForm(workLogCreateSchema, formData);
  if (!parsed.ok) return { ok: false, error: parsed.error, fieldErrors: parsed.fieldErrors };

  const session = await getSession();
  const log = await createWorkLog({
    ...parsed.data,
    technician_user_id: session?.id ?? null,
  });

  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "work_log",
    entity_id: log.id,
    action: "create",
    after: log,
  });

  revalidatePath("/maintenance/job-orders/" + log.job_order_id);
  return { ok: true, data: undefined };
}

// ----- Assets -----

export async function createAssetAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await assertPermission("asset:create");
  const parsed = parseForm(assetCreateSchema, formData);
  if (!parsed.ok) return { ok: false, error: parsed.error, fieldErrors: parsed.fieldErrors };
  const session = await getSession();
  const asset = await createAsset(parsed.data);
  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "asset",
    entity_id: asset.id,
    action: "create",
    after: asset,
  });
  revalidatePath("/maintenance/assets");
  redirect("/maintenance/assets/" + asset.id);
}

export async function updateAssetAction(
  id: string,
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await assertPermission("asset:update");
  const parsed = parseForm(assetUpdateSchema, formData);
  if (!parsed.ok) return { ok: false, error: parsed.error, fieldErrors: parsed.fieldErrors };
  const session = await getSession();
  const updated = await updateAsset(id, parsed.data);
  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "asset",
    entity_id: id,
    action: "update",
    after: updated,
  });
  revalidatePath("/maintenance/assets");
  revalidatePath("/maintenance/assets/" + id);
  return { ok: true, data: undefined };
}
`;

// =============================================================================
// ACCOUNTING — Approval flow
// =============================================================================

FILES["src/app/(dashboard)/accounting/approvals/page.tsx"] =
`import { requirePagePermission } from "@/lib/auth/guard";
import { listPendingApprovals } from "@/lib/db/job-orders";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { ApprovalTable } from "@/components/accounting/approval-table";

export default async function ApprovalsPage() {
  await requirePagePermission("invoice:create");
  const jobs = await listPendingApprovals();
  return (
    <div>
      <PageHeader
        title="Cost Approvals"
        description="Job orders above their task-type threshold awaiting your decision."
      />
      {jobs.length === 0 ? (
        <EmptyState
          title="Nothing to approve"
          description="All pending job orders are within budget."
        />
      ) : (
        <ApprovalTable jobs={jobs} />
      )}
    </div>
  );
}
`;

FILES["src/app/(dashboard)/accounting/approvals/actions.ts"] =
`"use server";

import { revalidatePath } from "next/cache";
import { assertPermission } from "@/lib/auth/guard";
import { getSession } from "@/lib/auth/get-session";
import { setJobOrderStatus } from "@/lib/db/job-orders";
import { emit } from "@/lib/events/emit";
import { logAudit } from "@/lib/audit/log";

export async function approveJobOrderAction(joborder_id: string) {
  await assertPermission("invoice:create");
  const session = await getSession();

  await setJobOrderStatus(joborder_id, "assigned");
  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "job_order",
    entity_id: joborder_id,
    action: "update",
    after: { status: "assigned" },
  });
  await emit("joborder.cost_approved", { joborder_id }, session?.id ?? null);

  revalidatePath("/accounting/approvals");
  revalidatePath("/maintenance");
}

export async function rejectJobOrderAction(joborder_id: string, reason: string) {
  await assertPermission("invoice:create");
  const session = await getSession();

  await setJobOrderStatus(joborder_id, "cancelled");
  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "job_order",
    entity_id: joborder_id,
    action: "update",
    after: { status: "cancelled", reason },
  });
  await emit("joborder.cost_rejected", { joborder_id, reason }, session?.id ?? null);

  revalidatePath("/accounting/approvals");
  revalidatePath("/maintenance");
}
`;

// =============================================================================
// UI — Job Order table
// =============================================================================

FILES["src/components/maintenance/job-order-table.tsx"] =
`import Link from "next/link";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatPHP } from "@/lib/utils/format-php";
import type { JobOrder } from "@/lib/db/job-orders";

const STATUS_TONE: Record<string, "gray" | "yellow" | "blue" | "green" | "red"> = {
  open: "gray",
  pending_approval: "yellow",
  assigned: "blue",
  in_progress: "blue",
  done: "green",
  cancelled: "red",
};

export function JobOrderTable({ jobs }: { jobs: JobOrder[] }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <Table>
        <THead>
          <TR>
            <TH>Unit</TH><TH>Task</TH><TH>Priority</TH>
            <TH className="text-right">Cost</TH><TH>Status</TH>
            <TH className="text-right">Actions</TH>
          </TR>
        </THead>
        <TBody>
          {jobs.map((j) => (
            <TR key={j.id}>
              <TD className="font-medium">
                <Link href={"/maintenance/job-orders/" + j.id} className="text-brand-600 hover:underline">
                  {j.unit_number ?? "—"}
                </Link>
              </TD>
              <TD className="text-gray-600">{j.task_type_name ?? "—"}</TD>
              <TD className="capitalize text-gray-600">{j.priority}</TD>
              <TD className="text-right">{j.cost_estimate != null ? formatPHP(j.cost_estimate) : "—"}</TD>
              <TD><Badge tone={STATUS_TONE[j.status] ?? "gray"}>{j.status}</Badge></TD>
              <TD className="text-right">
                <Link href={"/maintenance/job-orders/" + j.id} className="text-brand-600 hover:underline text-sm">
                  View
                </Link>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
`;

// =============================================================================
// UI — Job Order form
// =============================================================================

FILES["src/components/maintenance/job-order-form.tsx"] =
`"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { createJobOrderAction, updateJobOrderAction } from "@/app/(dashboard)/maintenance/actions";
import type { ActionResult } from "@/lib/actions/result";
import type { JobOrder } from "@/lib/db/job-orders";
import type { Unit } from "@/lib/db/units";
import type { JobTaskType } from "@/lib/db/job-task-types";

const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const STATUSES = [
  { value: "open", label: "Open" },
  { value: "pending_approval", label: "Pending approval" },
  { value: "assigned", label: "Assigned" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
  { value: "cancelled", label: "Cancelled" },
];

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" loading={pending}>{label}</Button>;
}

export function JobOrderForm({
  mode,
  job,
  units,
  taskTypes,
}: {
  mode: "create" | "edit";
  job?: JobOrder;
  units: Unit[];
  taskTypes: JobTaskType[];
}) {
  const router = useRouter();
  const toast = useToast();
  const action = mode === "create" ? createJobOrderAction : updateJobOrderAction.bind(null, job!.id);
  const [state, formAction] = useActionState<ActionResult | null, FormData>(action, null);

  useEffect(() => {
    if (state?.ok) {
      toast.push(mode === "create" ? "Job order created" : "Job order updated", "success");
      if (mode === "edit") router.refresh();
    } else if (state && !state.ok) {
      toast.push(state.error, "error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const fieldError = (k: string) => (state && !state.ok ? state.fieldErrors?.[k] : undefined);

  const unitOptions = units.map((u) => ({
    value: u.id,
    label: u.unit_number + (u.property_name ? " — " + u.property_name : ""),
  }));
  const typeOptions = taskTypes.map((t) => ({ value: t.id, label: t.name }));

  return (
    <Card>
      <CardBody>
        <form action={formAction} className="space-y-4">
          <Select
            name="unit_id" label="Unit" options={unitOptions} placeholder="Select a unit"
            defaultValue={job?.unit_id ?? ""} error={fieldError("unit_id")} required
          />
          <Select
            name="task_type_id" label="Task type" options={typeOptions} placeholder="Select a task type"
            defaultValue={job?.task_type_id ?? ""} error={fieldError("task_type_id")} required
          />
          <Select
            name="priority" label="Priority" options={PRIORITIES}
            defaultValue={job?.priority ?? "normal"} error={fieldError("priority")}
          />
          <Textarea
            name="description" label="Description" rows={4}
            defaultValue={job?.description ?? ""} error={fieldError("description")}
            required
          />
          <Input
            name="cost_estimate" label="Cost estimate (PHP)" type="number" step="0.01" min={0}
            defaultValue={job?.cost_estimate ?? 0} error={fieldError("cost_estimate")}
            hint="If this exceeds the task-type threshold, accounting approval is required."
          />
          {mode === "edit" && (
            <Select
              name="status" label="Status" options={STATUSES}
              defaultValue={job?.status ?? "open"} error={fieldError("status")}
            />
          )}
          <div className="flex items-center gap-3 pt-2">
            <SubmitButton label={mode === "create" ? "Create Job Order" : "Save Changes"} />
            <Button type="button" variant="secondary" onClick={() => router.push("/maintenance")}>
              Cancel
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
`;

// =============================================================================
// UI — Job Order actions (start / complete)
// =============================================================================

FILES["src/components/maintenance/job-order-actions.tsx"] =
`"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  completeJobOrderAction,
  startJobOrderAction,
} from "@/app/(dashboard)/maintenance/actions";
import type { JobOrder } from "@/lib/db/job-orders";

export function JobOrderActions({ job }: { job: JobOrder }) {
  const [pending, start] = useTransition();
  const toast = useToast();

  function onStart() {
    start(async () => {
      try { await startJobOrderAction(job.id); toast.push("Job started", "success"); }
      catch { toast.push("Failed to start", "error"); }
    });
  }

  function onComplete() {
    start(async () => {
      try { await completeJobOrderAction(job.id, job.unit_id); toast.push("Job completed", "success"); }
      catch { toast.push("Failed to complete", "error"); }
    });
  }

  const canStart = job.status === "open" || job.status === "assigned";
  const canComplete = job.status === "in_progress" || job.status === "assigned";

  if (!canStart && !canComplete) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-2">
      <p className="text-sm font-medium text-gray-700">Actions</p>
      {canStart && <Button onClick={onStart} loading={pending}>Start work</Button>}
      {canComplete && <Button variant="primary" onClick={onComplete} loading={pending}>Mark completed</Button>}
    </div>
  );
}
`;

// =============================================================================
// UI — Work Log panel
// =============================================================================

FILES["src/components/maintenance/work-log-panel.tsx"] =
`"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { createWorkLogAction } from "@/app/(dashboard)/maintenance/actions";
import type { ActionResult } from "@/lib/actions/result";
import type { WorkLog } from "@/lib/db/work-logs";

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" loading={pending} size="sm">Add log</Button>;
}

export function WorkLogPanel({ jobOrderId, logs }: { jobOrderId: string; logs: WorkLog[] }) {
  const toast = useToast();
  const [state, formAction] = useActionState<ActionResult | null, FormData>(createWorkLogAction, null);

  useEffect(() => {
    if (state?.ok) toast.push("Work log added", "success");
    else if (state && !state.ok) toast.push(state.error, "error");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const fieldError = (k: string) => (state && !state.ok ? state.fieldErrors?.[k] : undefined);

  return (
    <Card>
      <CardHeader title="Work Logs" description={logs.length + " entries"} />
      <CardBody className="space-y-4">
        <form action={formAction} className="space-y-3 border-b border-gray-100 pb-4">
          <input type="hidden" name="job_order_id" value={jobOrderId} />
          <Textarea name="notes" label="Notes" rows={2} error={fieldError("notes")} required />
          <div className="grid grid-cols-2 gap-3">
            <Input name="hours" label="Hours" type="number" step="0.25" min={0} error={fieldError("hours")} />
            <Input name="parts_used" label="Parts used (summary)" error={fieldError("parts_used")} />
          </div>
          <SubmitButton />
        </form>

        {logs.length === 0 ? (
          <p className="text-sm text-gray-500">No work logs yet.</p>
        ) : (
          <ul className="space-y-3">
            {logs.map((l) => (
              <li key={l.id} className="text-sm">
                <p className="text-gray-800">{l.notes}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {l.hours ? l.hours + "h · " : ""}
                  {l.completed_at ? new Date(l.completed_at).toLocaleString("en-PH") : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
`;

// =============================================================================
// UI — Approval table
// =============================================================================

FILES["src/components/accounting/approval-table.tsx"] =
`"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { formatPHP } from "@/lib/utils/format-php";
import { approveJobOrderAction, rejectJobOrderAction } from "@/app/(dashboard)/accounting/approvals/actions";
import type { JobOrder } from "@/lib/db/job-orders";

export function ApprovalTable({ jobs }: { jobs: JobOrder[] }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <Table>
        <THead>
          <TR>
            <TH>Unit</TH><TH>Task</TH><TH>Description</TH>
            <TH className="text-right">Cost</TH>
            <TH className="text-right">Decision</TH>
          </TR>
        </THead>
        <TBody>
          {jobs.map((j) => <ApprovalRow key={j.id} job={j} />)}
        </TBody>
      </Table>
    </div>
  );
}

function ApprovalRow({ job }: { job: JobOrder }) {
  const [pending, start] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const toast = useToast();

  function onApprove() {
    start(async () => {
      try {
        await approveJobOrderAction(job.id);
        toast.push("Approved", "success");
      } catch { toast.push("Failed", "error"); }
    });
  }

  function onReject() {
    if (!rejecting) { setRejecting(true); return; }
    if (!reason.trim()) { toast.push("Reason required", "error"); return; }
    start(async () => {
      try {
        await rejectJobOrderAction(job.id, reason.trim());
        toast.push("Rejected", "success");
      } catch { toast.push("Failed", "error"); }
    });
  }

  return (
    <TR>
      <TD className="font-medium">
        <Link href={"/maintenance/job-orders/" + job.id} className="text-brand-600 hover:underline">
          {job.unit_number ?? "—"}
        </Link>
      </TD>
      <TD className="text-gray-600">{job.task_type_name ?? "—"}</TD>
      <TD className="text-gray-600 text-xs max-w-xs truncate">{job.description ?? ""}</TD>
      <TD className="text-right font-medium">
        {job.cost_estimate != null ? formatPHP(job.cost_estimate) : "—"}
      </TD>
      <TD className="text-right">
        <div className="flex items-center justify-end gap-2">
          {rejecting && (
            <input
              type="text"
              placeholder="Reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-xs w-40"
            />
          )}
          <Button size="sm" onClick={onApprove} loading={pending && !rejecting}>Approve</Button>
          <Button size="sm" variant={rejecting ? "danger" : "secondary"} onClick={onReject} loading={pending && rejecting}>
            {rejecting ? "Confirm reject" : "Reject"}
          </Button>
        </div>
      </TD>
    </TR>
  );
}
`;

// =============================================================================
// UI — Sidebar update (add Maintenance + Approvals links)
// =============================================================================

FILES["src/components/shell/sidebar.tsx"] =
`import Link from "next/link";
import type { UserRole } from "@/lib/auth/get-user-roles";

type NavItem = { href: string; label: string; roles: string[] };
type NavGroup = { label: string; roles: string[]; items: NavItem[] };

const GROUPS: NavGroup[] = [
  {
    label: "Overview",
    roles: ["*"],
    items: [{ href: "/dashboard", label: "Dashboard", roles: ["*"] }],
  },
  {
    label: "Property",
    roles: ["property_rep", "executive", "marketing", "maintenance"],
    items: [
      { href: "/property/properties", label: "Properties", roles: ["property_rep", "executive"] },
      { href: "/property/units",      label: "Units",      roles: ["property_rep", "executive", "marketing", "maintenance"] },
      { href: "/property/tenants",    label: "Tenants",    roles: ["property_rep", "executive"] },
      { href: "/property/leases",     label: "Leases",     roles: ["property_rep", "executive"] },
      { href: "/property/contracts",  label: "Contracts",  roles: ["property_rep", "executive"] },
      { href: "/property/templates",  label: "Templates",  roles: ["property_rep", "executive"] },
    ],
  },
  {
    label: "Maintenance",
    roles: ["maintenance", "executive", "property_rep"],
    items: [
      { href: "/maintenance",              label: "Job Orders", roles: ["maintenance", "executive", "property_rep"] },
      { href: "/maintenance/job-orders/new", label: "New Job Order", roles: ["maintenance", "property_rep"] },
      { href: "/maintenance/assets",       label: "Assets",     roles: ["maintenance", "executive"] },
      { href: "/maintenance/task-types",   label: "Task Types", roles: ["executive"] },
    ],
  },
  {
    label: "Accounting",
    roles: ["accounting", "executive"],
    items: [
      { href: "/accounting",           label: "Overview",  roles: ["accounting", "executive"] },
      { href: "/accounting/approvals", label: "Approvals", roles: ["accounting", "executive"] },
    ],
  },
  {
    label: "Marketing",
    roles: ["marketing", "executive"],
    items: [{ href: "/marketing", label: "Marketing", roles: ["marketing", "executive"] }],
  },
  {
    label: "Admin",
    roles: ["executive", "system_admin"],
    items: [
      { href: "/executive", label: "Executive",    roles: ["executive"] },
      { href: "/admin",     label: "System Admin", roles: ["system_admin"] },
    ],
  },
];

export function Sidebar({ roles }: { roles: UserRole[] }) {
  const keys = roles.map((r) => r.role_key);

  const visibleGroups: NavGroup[] = GROUPS.map((g) => {
    if (!g.roles.includes("*") && !g.roles.some((r) => keys.includes(r))) return null;
    const items = g.items.filter(
      (item) => item.roles.includes("*") || item.roles.some((r) => keys.includes(r))
    );
    if (items.length === 0) return null;
    return { ...g, items };
  }).filter((g): g is NavGroup => g !== null);

  return (
    <aside className="w-60 bg-white border-r border-gray-200 flex flex-col">
      <div className="h-14 flex items-center px-4 border-b border-gray-200">
        <span className="font-semibold text-brand-500">Apartment Portal</span>
      </div>
      <nav className="flex-1 overflow-y-auto p-2 space-y-4">
        {visibleGroups.map((g) => (
          <div key={g.label}>
            <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
              {g.label}
            </p>
            {g.items.map((item) => (
              <Link key={item.href} href={item.href}
                className="block px-3 py-1.5 rounded text-sm text-gray-700 hover:bg-gray-100">
                {item.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
`;

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------
async function main() {
  const pkg = join(ROOT, "package.json");
  if (!(await exists(pkg))) {
    console.error("package.json not found. Run from project root.");
    process.exit(1);
  }
  const pkgText = await readFile(pkg, "utf8");
  if (!pkgText.includes('"apartment-portal"')) {
    console.warn("package.json name isn't 'apartment-portal'. Continue? (Enter to proceed)");
    await new Promise((r) => process.stdin.once("data", r));
  }

  console.log("Phase 2 - Maintenance module\\n");

  let count = 0;
  for (const [relPath, content] of Object.entries(FILES)) {
    const full = join(ROOT, relPath);
    const exists_ = await exists(full);
    console.log((exists_ ? "  ~ " : "  + ") + relPath);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, content, "utf8");
    count++;
  }
  console.log("\\nDone - " + count + " file(s) written.\\n");
  console.log("Next:");
  console.log("  npm run typecheck");
  console.log("  npm run dev");
  console.log("\\nTest flow:");
  console.log("  1. Create a job order as maintenance/property_rep");
  console.log("  2. Approve it as accounting");
  console.log("  3. Mark complete, dispatch events, check unit becomes vacant");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});