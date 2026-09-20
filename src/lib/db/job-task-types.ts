import "server-only";
import { createClient } from "@/lib/supabase/server";

export type JobTaskType = {
  id: string;
  key: string;
  name: string;
  approval_threshold_php: number;
};

// Standard task types with PHP thresholds. Used as a fallback when
// the DB table is empty or not yet seeded, so the UI is never broken.
// Once maint.job_task_type is populated, DB rows take precedence.
const FALLBACK_TASK_TYPES: JobTaskType[] = [
  { id: "plumbing",     key: "plumbing",     name: "Plumbing",         approval_threshold_php: 5000  },
  { id: "electrical",   key: "electrical",   name: "Electrical",       approval_threshold_php: 5000  },
  { id: "hvac",         key: "hvac",         name: "HVAC / Aircon",    approval_threshold_php: 8000  },
  { id: "appliance",    key: "appliance",    name: "Appliance Repair", approval_threshold_php: 3000  },
  { id: "carpentry",    key: "carpentry",    name: "Carpentry",        approval_threshold_php: 2000  },
  { id: "painting",     key: "painting",     name: "Painting",         approval_threshold_php: 2000  },
  { id: "cleaning",     key: "cleaning",     name: "Cleaning",         approval_threshold_php: 1000  },
  { id: "pest_control", key: "pest_control", name: "Pest Control",     approval_threshold_php: 1500  },
  { id: "turnover",     key: "turnover",     name: "Unit Turnover",    approval_threshold_php: 10000 },
  { id: "other",        key: "other",        name: "Other",            approval_threshold_php: 3000  },
];

export async function listTaskTypes(): Promise<JobTaskType[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_task_type")
    .select("id, key, name, approval_threshold_php")
    .order("name", { ascending: true });

  console.log("[listTaskTypes] error:", error);
  console.log("[listTaskTypes] row count:", data?.length ?? 0);
  console.log("[listTaskTypes] first row:", data?.[0]);

  if (error) {
    console.warn("[listTaskTypes] falling back:", error.message);
    return FALLBACK_TASK_TYPES;
  }

  const rows = (data ?? []) as JobTaskType[];
  if (rows.length === 0) {
    console.warn("[listTaskTypes] empty — using fallback");
    return FALLBACK_TASK_TYPES;
  }

  return rows;
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