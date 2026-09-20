import "server-only";
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
