import { cn } from "@/lib/utils/cn";
import { JOB_EVENT_COLORS, JOB_EVENT_LABELS } from "@/lib/maintenance/calendar-types";

const ORDER: (keyof typeof JOB_EVENT_COLORS)[] = [
  "job_open",
  "job_pending_approval",
  "job_assigned",
  "job_in_progress",
  "job_done",
  "job_cancelled",
];

export function JobLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      {ORDER.map((t) => (
        <div key={t} className="flex items-center gap-2 text-xs text-ink-600">
          <span className={cn("h-2 w-2 rounded-full", JOB_EVENT_COLORS[t].dot)} />
          {JOB_EVENT_LABELS[t]}
        </div>
      ))}
    </div>
  );
}
