import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  JOB_EVENT_LABELS,
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
  let overdueCount = 0;

  const today = ymd(new Date());

  for (const date of Object.keys(month.eventsByDate)) {
    for (const e of month.eventsByDate[date]) {
      counts[e.type] = (counts[e.type] ?? 0) + 1;
      if (e.cost) totalCost += e.cost;
      if (e.priority === "urgent" && e.status !== "done" && e.status !== "cancelled") urgentCount++;
      // Overdue: scheduled date is in the past, job not done
      if (
        e.meta?.kind === "scheduled" &&
        e.date < today &&
        e.status !== "done" &&
        e.status !== "cancelled"
      ) {
        overdueCount++;
      }
    }
  }

  return { counts, totalCost, urgentCount, overdueCount };
}

/**
 * Jobs that need attention right now:
 *  - Scheduled in the past but not done/cancelled (overdue)
 *  - Scheduled within the next N days
 *  - Urgent and still open/pending/in_progress
 */
export async function getUpcomingJobs(days = 7, property_id?: string | null) {
  const supabase = await createClient();
  const today = new Date();
  const todayStr = ymd(today);
  const cutoff = ymd(new Date(today.getTime() + days * 86400000));

  const { data: jobs } = await supabase
    .from("job_order")
    .select(
      "id, unit_id, task_type_id, priority, status, description, cost_estimate, scheduled_date"
    )
    .in("status", ["open", "pending_approval", "assigned", "in_progress"])
    .not("scheduled_date", "is", null)
    .lte("scheduled_date", cutoff)
    .order("scheduled_date", { ascending: true });

  const rows = (jobs ?? []) as any[];
  if (rows.length === 0) return [];

  const unitIds = Array.from(new Set(rows.map((r) => r.unit_id))).filter(Boolean);
  const taskTypeIds = Array.from(new Set(rows.map((r) => r.task_type_id))).filter(Boolean);

  const [{ data: units }, { data: types }] = await Promise.all([
    unitIds.length > 0
      ? supabase.from("unit").select("id, unit_number, property_id").in("id", unitIds)
      : Promise.resolve({ data: [] as any[] }),
    taskTypeIds.length > 0
      ? supabase.from("job_task_type").select("id, name").in("id", taskTypeIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const unitMap = new Map((units ?? []).map((u: any) => [u.id, u]));
  const taskMap = new Map((types ?? []).map((t: any) => [t.id, t.name]));

  const propIds = Array.from(new Set((units ?? []).map((u: any) => u.property_id))).filter(Boolean);
  const { data: props } = propIds.length > 0
    ? await supabase.from("property").select("id, name").in("id", propIds)
    : { data: [] as { id: string; name: string }[] };
  const propMap = new Map((props ?? []).map((p: any) => [p.id, p.name]));

  let result = rows.map((j) => {
    const u = unitMap.get(j.unit_id) as any;
    const isOverdue = j.scheduled_date < todayStr;
    const daysUntil = Math.ceil(
      (new Date(j.scheduled_date).getTime() - today.getTime()) / 86400000
    );
    return {
      id: j.id,
      scheduled_date: j.scheduled_date,
      days_until: daysUntil,
      is_overdue: isOverdue,
      priority: j.priority,
      status: j.status,
      task_type_name: taskMap.get(j.task_type_id) ?? "Job order",
      unit_number: u?.unit_number ?? "—",
      property_id: u?.property_id as string | undefined,
      property_name: u ? propMap.get(u.property_id) : undefined,
    };
  });

  if (property_id) {
    result = result.filter((r) => r.property_id === property_id);
  }

  return result;
}

/**
 * CSV export for a given month.
 */
export async function exportJobMonthCsv(
  year: number,
  month: number
): Promise<string> {
  const data = await getJobCalendarMonth(year, month, { statuses: [], priorities: [] });

  function escape(v: string): string {
    if (v.includes(",") || v.includes('"') || v.includes("\n")) {
      return '"' + v.replace(/"/g, '""') + '"';
    }
    return v;
  }

  const rows: string[] = [];
  rows.push(
    ["Date", "Kind", "Status", "Priority", "Title", "Unit", "Property", "Task", "Cost", "Link"]
      .map(escape)
      .join(",")
  );

  const dates = Object.keys(data.eventsByDate).sort();
  for (const date of dates) {
    for (const e of data.eventsByDate[date]) {
      rows.push(
        [
          e.date,
          String(e.meta?.kind ?? ""),
          e.status,
          e.priority,
          e.title,
          e.unit_number ?? "",
          e.property_name ?? "",
          e.task_type_name ?? "",
          e.cost != null ? e.cost.toFixed(2) : "",
          e.href ? (process.env.NEXT_PUBLIC_APP_URL ?? "") + e.href : "",
        ]
          .map(escape)
          .join(",")
      );
    }
  }

  return rows.join("\n");
}
