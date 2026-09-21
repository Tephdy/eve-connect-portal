#!/usr/bin/env node
/**
 * Job Orders — add scheduled_date field
 * Usage: node scaffold-joborder-scheduled.mjs
 *
 * Updates:
 *   src/lib/schemas/job-order.ts                       (add scheduled_date)
 *   src/lib/db/job-orders.ts                           (type + select + writes)
 *   src/components/maintenance/job-order-form.tsx      (date input)
 *   src/components/maintenance/job-order-table.tsx     (Scheduled column)
 *   src/app/(dashboard)/maintenance/job-orders/[id]/page.tsx  (show scheduled in summary)
 *   src/lib/maintenance/calendar-aggregate.ts          (calendar event on scheduled_date)
 */

import { mkdir, writeFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import { join, dirname } from "node:path";

const ROOT = process.cwd();
const FILES = {};

async function exists(p) {
  try { await access(p, constants.F_OK); return true; } catch { return false; }
}

// =============================================================================
// 1. Zod schema
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
  scheduled_date: z.string().optional().or(z.literal("")),
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
// 2. DB layer — add scheduled_date
// =============================================================================
FILES["src/lib/db/job-orders.ts"] =
`import "server-only";
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
  scheduled_date: string | null;
  created_at: string;
  closed_at: string | null;
  unit_number?: string;
  property_name?: string;
  task_type_name?: string;
};

const JOB_ORDER_SELECT =
  "id, unit_id, task_type_id, requested_by_user_id, priority, description, status, cost_estimate, assigned_to, created_at, closed_at, scheduled_date";

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

function logWriteError(fn: string, error: any) {
  console.error("[" + fn + "]", JSON.stringify(error, null, 2));
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
      scheduled_date: input.scheduled_date || null,
    })
    .select(JOB_ORDER_SELECT)
    .single();

  if (error) {
    logWriteError("createJobOrder", error);
    throw new Error(error.message);
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
  if (input.scheduled_date !== undefined) {
    patch.scheduled_date = input.scheduled_date || null;
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
  const { error } = await admin.schema("maint").from("job_order").update(patch).eq("id", id);
  if (error) {
    logWriteError("setJobOrderStatus", error);
    throw new Error(error.message);
  }
}

export async function deleteJobOrder(id: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.schema("maint").from("job_order").delete().eq("id", id);
  if (error) {
    logWriteError("deleteJobOrder", error);
    throw new Error(error.message);
  }
}
`;

// =============================================================================
// 3. Job Order Form — add scheduled_date field
// =============================================================================
FILES["src/components/maintenance/job-order-form.tsx"] =
`"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Calendar } from "lucide-react";
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

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + day;
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

  // Default scheduled date: today (for new jobs) or existing value (for edits)
  const scheduledDefault = job?.scheduled_date ?? (mode === "create" ? todayIso() : "");

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

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Select
              name="priority" label="Priority" options={PRIORITIES}
              defaultValue={job?.priority ?? "normal"} error={fieldError("priority")}
            />
            <div className="space-y-1.5">
              <label
                htmlFor="scheduled_date"
                className="flex items-center gap-1.5 text-sm font-medium text-ink-700"
              >
                <Calendar className="h-3.5 w-3.5 text-ink-400" />
                Scheduled date
              </label>
              <input
                id="scheduled_date"
                name="scheduled_date"
                type="date"
                defaultValue={scheduledDefault}
                className="h-9 w-full rounded-md border border-ink-200 bg-surface px-3 text-sm text-ink-900 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-white/[0.06]"
              />
              <p className="text-xs text-ink-500">
                When the work is planned to be done.
              </p>
            </div>
          </div>

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
// 4. Job Order Table — add Scheduled column
// =============================================================================
FILES["src/components/maintenance/job-order-table.tsx"] =
`import Link from "next/link";
import { Wrench } from "lucide-react";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Card, CardBody } from "@/components/ui/card";
import { StatusPill } from "@/components/dashboard/status-pill";
import { formatPHP } from "@/lib/utils/format-php";
import type { JobOrder } from "@/lib/db/job-orders";

const STATUS_TONE: Record<string, "gray" | "yellow" | "brand" | "green" | "red" | "purple"> = {
  open: "gray",
  pending_approval: "yellow",
  assigned: "brand",
  in_progress: "purple",
  done: "green",
  cancelled: "red",
};

const PRIORITY_TONE: Record<string, "gray" | "brand" | "yellow" | "red"> = {
  low: "gray",
  normal: "brand",
  high: "yellow",
  urgent: "red",
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function JobOrderTable({ jobs }: { jobs: JobOrder[] }) {
  return (
    <Card className="overflow-hidden">
      <CardBody className="p-0">
        <Table>
          <THead>
            <TR>
              <TH>Job order</TH>
              <TH>Task</TH>
              <TH>Priority</TH>
              <TH>Scheduled</TH>
              <TH className="text-right">Cost</TH>
              <TH>Status</TH>
              <TH className="text-right"></TH>
            </TR>
          </THead>
          <TBody>
            {jobs.map((j) => {
              const isOverdue =
                j.scheduled_date &&
                j.status !== "done" &&
                j.status !== "cancelled" &&
                new Date(j.scheduled_date) < new Date();
              return (
                <TR key={j.id}>
                  <TD>
                    <Link
                      href={"/maintenance/job-orders/" + j.id}
                      className="flex items-center gap-3 group"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400">
                        <Wrench className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-ink-900 group-hover:text-brand-600 dark:group-hover:text-brand-400">
                          {j.unit_number ?? "—"}
                        </p>
                        {j.property_name && (
                          <p className="truncate text-xs text-ink-500">{j.property_name}</p>
                        )}
                      </div>
                    </Link>
                  </TD>
                  <TD className="text-ink-600">{j.task_type_name ?? "—"}</TD>
                  <TD>
                    <StatusPill tone={PRIORITY_TONE[j.priority] ?? "gray"}>
                      {j.priority}
                    </StatusPill>
                  </TD>
                  <TD>
                    {j.scheduled_date ? (
                      <span
                        className={
                          "text-sm " +
                          (isOverdue
                            ? "font-medium text-danger-700 dark:text-danger-500"
                            : "text-ink-600")
                        }
                      >
                        {formatDate(j.scheduled_date)}
                        {isOverdue && <span className="ml-1.5 text-xs">(overdue)</span>}
                      </span>
                    ) : (
                      <span className="text-sm text-ink-400">—</span>
                    )}
                  </TD>
                  <TD className="text-right font-medium text-ink-900">
                    {j.cost_estimate != null ? formatPHP(j.cost_estimate) : "—"}
                  </TD>
                  <TD>
                    <StatusPill tone={STATUS_TONE[j.status] ?? "gray"} dot>
                      {j.status.replace("_", " ")}
                    </StatusPill>
                  </TD>
                  <TD className="text-right">
                    <Link
                      href={"/maintenance/job-orders/" + j.id}
                      className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
                    >
                      View
                    </Link>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </CardBody>
    </Card>
  );
}
`;

// =============================================================================
// 5. Calendar aggregate — add scheduled_date events
// =============================================================================
FILES["src/lib/maintenance/calendar-aggregate.ts"] =
`import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  STATUS_TO_EVENT,
  type JobCalendarEvent,
  type JobCalendarFilters,
  type JobCalendarMonth,
} from "./calendar-types";

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + day;
}

function firstDayOfMonth(year: number, month: number): Date {
  return new Date(year, month - 1, 1);
}

function lastDayOfMonth(year: number, month: number): Date {
  return new Date(year, month, 0);
}

export async function getJobCalendarMonth(
  year: number,
  month: number,
  filters: JobCalendarFilters = { statuses: [], priorities: [] }
): Promise<JobCalendarMonth> {
  const supabase = await createClient();

  const startStr = ymd(firstDayOfMonth(year, month));
  const endStr = ymd(lastDayOfMonth(year, month));

  // Load jobs whose created_at OR scheduled_date OR closed_at is within the window
  const { data: jobs } = await supabase
    .from("job_order")
    .select(
      "id, unit_id, task_type_id, priority, status, description, cost_estimate, created_at, closed_at, scheduled_date, requested_by_user_id"
    )
    .or(
      "and(created_at.gte." + startStr + "T00:00:00.000Z,created_at.lte." + endStr + "T23:59:59.999Z)," +
      "and(scheduled_date.gte." + startStr + ",scheduled_date.lte." + endStr + ")," +
      "and(closed_at.gte." + startStr + "T00:00:00.000Z,closed_at.lte." + endStr + "T23:59:59.999Z)"
    )
    .order("created_at", { ascending: true });

  const jobRows = (jobs ?? []) as any[];
  const unitIds = Array.from(new Set(jobRows.map((j) => j.unit_id))).filter(Boolean);
  const taskTypeIds = Array.from(new Set(jobRows.map((j) => j.task_type_id))).filter(Boolean);

  const unitLookup = new Map<
    string,
    { unit_number: string; property_id: string; property_name: string }
  >();
  if (unitIds.length > 0) {
    const { data: units } = await supabase
      .from("unit")
      .select("id, unit_number, property_id")
      .in("id", unitIds);

    const propIds = Array.from(new Set((units ?? []).map((u: any) => u.property_id))).filter(Boolean);
    const { data: props } = propIds.length > 0
      ? await supabase.from("property").select("id, name").in("id", propIds)
      : { data: [] as { id: string; name: string }[] };

    const propMap = new Map((props ?? []).map((p: any) => [p.id, p.name]));
    for (const u of units ?? []) {
      unitLookup.set(u.id, {
        unit_number: u.unit_number,
        property_id: u.property_id,
        property_name: propMap.get(u.property_id) ?? "",
      });
    }
  }

  const taskMap = new Map<string, string>();
  if (taskTypeIds.length > 0) {
    const { data: types } = await supabase
      .from("job_task_type")
      .select("id, name")
      .in("id", taskTypeIds);
    for (const t of types ?? []) taskMap.set(t.id, t.name);
  }

  const eventsByDate: Record<string, JobCalendarEvent[]> = {};

  function push(date: string, evt: JobCalendarEvent) {
    if (!eventsByDate[date]) eventsByDate[date] = [];
    eventsByDate[date].push(evt);
  }

  function passFilters(j: any) {
    const info = unitLookup.get(j.unit_id);
    if (filters.property_id && info?.property_id !== filters.property_id) return false;
    if (filters.statuses.length > 0 && !filters.statuses.includes(j.status)) return false;
    if (filters.priorities.length > 0 && !filters.priorities.includes(j.priority)) return false;
    return true;
  }

  for (const j of jobRows) {
    if (!passFilters(j)) continue;
    const info = unitLookup.get(j.unit_id);
    const eventType = STATUS_TO_EVENT[j.status] ?? "job_open";

    // 1) Created event
    const createdDate = j.created_at.slice(0, 10);
    if (createdDate >= startStr && createdDate <= endStr) {
      push(createdDate, {
        id: "job_" + j.id,
        date: createdDate,
        type: eventType,
        title: (taskMap.get(j.task_type_id) ?? "Job order") + " — " + (info?.unit_number ?? "Unit ?"),
        subtitle:
          (info?.property_name ? info.property_name : "") +
          (j.description ? " · " + j.description.slice(0, 60) : ""),
        priority: j.priority,
        status: j.status,
        cost: j.cost_estimate != null ? Number(j.cost_estimate) : undefined,
        href: "/maintenance/job-orders/" + j.id,
        unit_number: info?.unit_number,
        property_name: info?.property_name,
        task_type_name: taskMap.get(j.task_type_id),
        meta: { kind: "created" },
      });
    }

    // 2) Scheduled event (if different from created date)
    if (j.scheduled_date && j.scheduled_date >= startStr && j.scheduled_date <= endStr) {
      if (j.scheduled_date !== createdDate) {
        push(j.scheduled_date, {
          id: "job_sched_" + j.id,
          date: j.scheduled_date,
          type: eventType,
          title: "Scheduled: " + (taskMap.get(j.task_type_id) ?? "Job order") + " — " + (info?.unit_number ?? ""),
          subtitle: info?.property_name ?? "",
          priority: j.priority,
          status: j.status,
          cost: j.cost_estimate != null ? Number(j.cost_estimate) : undefined,
          href: "/maintenance/job-orders/" + j.id,
          unit_number: info?.unit_number,
          property_name: info?.property_name,
          task_type_name: taskMap.get(j.task_type_id),
          meta: { kind: "scheduled" },
        });
      }
    }

    // 3) Closed event
    if ((j.status === "done" || j.status === "cancelled") && j.closed_at) {
      const closedDate = j.closed_at.slice(0, 10);
      if (closedDate >= startStr && closedDate <= endStr && closedDate !== createdDate) {
        push(closedDate, {
          id: "job_closed_" + j.id,
          date: closedDate,
          type: eventType,
          title: "Closed: " + (taskMap.get(j.task_type_id) ?? "Job order") + " — " + (info?.unit_number ?? ""),
          subtitle: info?.property_name ?? "",
          priority: j.priority,
          status: j.status,
          cost: j.cost_estimate != null ? Number(j.cost_estimate) : undefined,
          href: "/maintenance/job-orders/" + j.id,
          unit_number: info?.unit_number,
          property_name: info?.property_name,
          task_type_name: taskMap.get(j.task_type_id),
          meta: { kind: "closed" },
        });
      }
    }
  }

  const statusOrder = ["urgent", "high", "normal", "low"];
  for (const date of Object.keys(eventsByDate)) {
    eventsByDate[date].sort((a, b) => {
      const pa = statusOrder.indexOf(a.priority);
      const pb = statusOrder.indexOf(b.priority);
      if (pa !== pb) return pa - pb;
      return a.status.localeCompare(b.status);
    });
  }

  return { year, month, eventsByDate };
}

export function summarizeJobMonth(month: JobCalendarMonth) {
  const counts: Record<string, number> = {};
  let totalCost = 0;
  let urgentCount = 0;

  for (const date of Object.keys(month.eventsByDate)) {
    for (const e of month.eventsByDate[date]) {
      counts[e.type] = (counts[e.type] ?? 0) + 1;
      if (e.cost) totalCost += e.cost;
      if (e.priority === "urgent" && e.status !== "done" && e.status !== "cancelled") urgentCount++;
    }
  }

  return { counts, totalCost, urgentCount };
}
`;

// =============================================================================
// 6. Job Order Detail page — show scheduled in summary
// =============================================================================
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
import { CancelJobOrderButton } from "@/components/maintenance/cancel-job-order-button";
import { DeleteJobOrderButton } from "@/components/maintenance/delete-job-order-button";
import { hasPermission } from "@/lib/auth/require-permission";
import { formatPHP } from "@/lib/utils/format-php";

const STATUS_TONE: Record<string, "gray" | "yellow" | "blue" | "green" | "red"> = {
  open: "gray",
  pending_approval: "yellow",
  assigned: "blue",
  in_progress: "blue",
  done: "green",
  cancelled: "red",
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function JobOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("joborder:read");
  const { id } = await params;
  const job = await getJobOrder(id);
  if (!job) notFound();

  const [units, types, logs, canDelete, canUpdate, canClose] = await Promise.all([
    listUnits(),
    listTaskTypes(),
    listWorkLogs(job.id),
    hasPermission("joborder:delete"),
    hasPermission("joborder:update"),
    hasPermission("joborder:close"),
  ]);

  const canCancel = job.status !== "cancelled" && job.status !== "done";

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
          <div className="bg-white border border-ink-200 rounded-lg p-5 text-sm space-y-2 dark:border-white/[0.06] dark:bg-surface">
            <div className="flex justify-between">
              <span className="text-ink-500">Task type</span>
              <span className="font-medium">{job.task_type_name ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-500">Scheduled</span>
              <span className="font-medium">{formatDate(job.scheduled_date)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-500">Cost estimate</span>
              <span className="font-medium">
                {job.cost_estimate != null ? formatPHP(job.cost_estimate) : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-500">Priority</span>
              <span className="font-medium capitalize">{job.priority}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-500">Created</span>
              <span className="font-medium">{formatDate(job.created_at)}</span>
            </div>
          </div>
          <JobOrderActions job={job} canUpdate={canUpdate} canClose={canClose} />

          {canCancel && (
            <div className="bg-white border border-ink-200 rounded-lg p-5 space-y-2 dark:border-white/[0.06] dark:bg-surface">
              <p className="text-sm font-medium text-ink-700">Danger zone</p>
              <p className="text-xs text-ink-500">
                Cancel keeps the record for auditing. Delete removes it permanently.
              </p>
              <div className="flex flex-col gap-2 pt-1">
                {canClose && <CancelJobOrderButton id={job.id} />}
                {canDelete && <DeleteJobOrderButton id={job.id} />}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
`;

// -----------------------------------------------------------------------------
// Runner
// -----------------------------------------------------------------------------
async function main() {
  const pkg = join(ROOT, "package.json");
  if (!(await exists(pkg))) {
    console.error("package.json not found. Run from project root.");
    process.exit(1);
  }

  console.log("Job Orders — scheduled date field\\n");

  let count = 0;
  for (const [relPath, content] of Object.entries(FILES)) {
    const full = join(ROOT, relPath);
    const exists_ = await exists(full);
    console.log((exists_ ? "  ~ " : "  + ") + relPath);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, content, "utf8");
    count++;
  }

  console.log("\\nDone — " + count + " file(s) written.\\n");
  console.log("Next:");
  console.log("  1. Run the 030_job_order_scheduled.sql migration in Supabase");
  console.log("  2. npm run typecheck");
  console.log("  3. npm run dev");
  console.log("\\nTest:");
  console.log("  - /maintenance/job-orders/new → new Scheduled date field");
  console.log("  - /maintenance → Scheduled column shows in table");
  console.log("  - /maintenance/calendar → scheduled jobs appear on their scheduled day");
}


main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});