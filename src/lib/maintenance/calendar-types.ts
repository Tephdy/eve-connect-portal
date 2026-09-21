export type JobEventType =
  | "job_open"
  | "job_pending_approval"
  | "job_assigned"
  | "job_in_progress"
  | "job_done"
  | "job_cancelled";

export type JobCalendarEvent = {
  id: string;
  date: string; // YYYY-MM-DD
  type: JobEventType;
  title: string;
  subtitle?: string;
  priority: "low" | "normal" | "high" | "urgent";
  status: string;
  cost?: number;
  href?: string;
  unit_number?: string;
  property_name?: string;
  task_type_name?: string;
  meta?: Record<string, string | number | undefined>;
};

export type JobCalendarMonth = {
  year: number;
  month: number;
  eventsByDate: Record<string, JobCalendarEvent[]>;
};

export type JobCalendarFilters = {
  property_id?: string | null;
  statuses: string[];
  priorities: string[];
};

export const JOB_EVENT_LABELS: Record<JobEventType, string> = {
  job_open: "Open",
  job_pending_approval: "Pending approval",
  job_assigned: "Assigned",
  job_in_progress: "In progress",
  job_done: "Completed",
  job_cancelled: "Cancelled",
};

export const JOB_EVENT_COLORS: Record<
  JobEventType,
  { dot: string; bg: string; text: string; border: string }
> = {
  job_open: {
    dot: "bg-ink-500",
    bg: "bg-ink-500/10",
    text: "text-ink-700 dark:text-ink-500",
    border: "border-ink-500/30",
  },
  job_pending_approval: {
    dot: "bg-warning-500",
    bg: "bg-warning-500/10",
    text: "text-warning-700 dark:text-warning-500",
    border: "border-warning-500/30",
  },
  job_assigned: {
    dot: "bg-brand-500",
    bg: "bg-brand-500/10",
    text: "text-brand-700 dark:text-brand-400",
    border: "border-brand-500/30",
  },
  job_in_progress: {
    dot: "bg-purple-500",
    bg: "bg-purple-500/10",
    text: "text-purple-700 dark:text-purple-400",
    border: "border-purple-500/30",
  },
  job_done: {
    dot: "bg-success-500",
    bg: "bg-success-500/10",
    text: "text-success-700 dark:text-success-500",
    border: "border-success-500/30",
  },
  job_cancelled: {
    dot: "bg-danger-500",
    bg: "bg-danger-500/10",
    text: "text-danger-700 dark:text-danger-500",
    border: "border-danger-500/30",
  },
};

export const PRIORITY_LABELS: Record<string, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

export const STATUS_TO_EVENT: Record<string, JobEventType> = {
  open: "job_open",
  pending_approval: "job_pending_approval",
  assigned: "job_assigned",
  in_progress: "job_in_progress",
  done: "job_done",
  cancelled: "job_cancelled",
};

export const ALL_JOB_STATUSES = [
  "open",
  "pending_approval",
  "assigned",
  "in_progress",
  "done",
  "cancelled",
];

export const ALL_JOB_PRIORITIES = ["low", "normal", "high", "urgent"];
