import { requirePagePermission } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import {
  getCalendarMonth,
  summarizeMonth,
  getExpiringSoon,
} from "@/lib/calendar/aggregate";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { CalendarShell } from "@/components/calendar/calendar-shell";
import { formatPHP } from "@/lib/utils/format-php";

export default async function PropertyCalendarPage() {
  await requirePagePermission("lease:read");
  const supabase = await createClient();

  const now = new Date();

  const [month, properties, expiring] = await Promise.all([
    getCalendarMonth(now.getFullYear(), now.getMonth() + 1, { types: [] }),
    supabase.from("property").select("id, name").is("archived_at", null).order("name"),
    getExpiringSoon(30, null),
  ]);

  const summary = summarizeMonth(month);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        description="Rent dues, lease events, and payments across properties."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total due this month" value={formatPHP(summary.totalDue)} accent="yellow" />
        <StatCard label="Collected this month" value={formatPHP(summary.totalPaid)} accent="green" />
        <StatCard label="Overdue invoices" value={summary.overdue} accent="red" />
        <StatCard label="Events" value={Object.values(summary.counts).reduce((s, n) => s + n, 0)} accent="brand" />
      </div>

      <CalendarShell
        initial={month}
        properties={properties.data ?? []}
        expiringCount={expiring.length}
        expiringDays={30}
        expiringHref="/property/leases"
      />
    </div>
  );
}
