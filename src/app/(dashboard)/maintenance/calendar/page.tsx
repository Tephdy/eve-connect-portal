import Link from "next/link";
import { ArrowLeft, AlertTriangle, ArrowRight } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import {
  getJobCalendarMonth,
  summarizeJobMonth,
  getUpcomingJobs,
} from "@/lib/maintenance/calendar-aggregate";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { JobCalendarShell } from "@/components/maintenance/calendar/job-calendar-shell";
import { formatPHP } from "@/lib/utils/format-php";

export default async function MaintenanceCalendarPage() {
  await requirePagePermission("joborder:read");
  const supabase = await createClient();

  const now = new Date();

  const [month, properties, upcoming] = await Promise.all([
    getJobCalendarMonth(now.getFullYear(), now.getMonth() + 1, { statuses: [], priorities: [] }),
    supabase.from("property").select("id, name").is("archived_at", null).order("name"),
    getUpcomingJobs(7, null),
  ]);

  const summary = summarizeJobMonth(month);
  const total = Object.values(summary.counts).reduce((s, n) => s + n, 0);
  const overdue = upcoming.filter((j) => j.is_overdue);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/maintenance"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-ink-500 transition-colors hover:text-ink-800"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to job orders
        </Link>
        <PageHeader
          title="Maintenance calendar"
          description="Job orders by date — open, scheduled, and completed."
        />
      </div>

      {/* Overdue / upcoming banner */}
      {overdue.length > 0 && (
        <Link
          href="/maintenance"
          className="flex items-center justify-between gap-4 rounded-xl border border-danger-500/30 bg-danger-500/5 px-4 py-3 transition-colors hover:bg-danger-500/10 dark:border-danger-500/20 dark:bg-danger-500/[0.06]"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-danger-500/15 text-danger-700 dark:text-danger-500">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-medium text-ink-900">
                {overdue.length} job order{overdue.length === 1 ? "" : "s"} overdue
              </p>
              <p className="text-xs text-ink-500">
                Scheduled in the past, still not completed
              </p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-danger-700 dark:text-danger-500" />
        </Link>
      )}

      {upcoming.length > 0 && upcoming.length > overdue.length && (
        <div className="text-xs text-ink-500">
          {upcoming.length - overdue.length} more job{upcoming.length - overdue.length === 1 ? "" : "s"} scheduled in the next 7 days.
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total jobs this month" value={total} accent="brand" />
        <StatCard label="Urgent" value={summary.urgentCount} accent="red" />
        <StatCard label="Overdue" value={summary.overdueCount} accent="yellow" />
        <StatCard label="Total cost" value={formatPHP(summary.totalCost)} accent="purple" />
      </div>

      <JobCalendarShell initial={month} properties={properties.data ?? []} />
    </div>
  );
}
