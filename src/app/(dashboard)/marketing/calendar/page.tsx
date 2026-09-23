import { requirePagePermission } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { getCalendarMonth, getExpiringSoon } from "@/lib/calendar/aggregate";
import { PageHeader } from "@/components/layout/page-header";
import { CalendarShell } from "@/components/calendar/calendar-shell";

export default async function MarketingCalendarPage() {
  await requirePagePermission("listing:read");
  const supabase = await createClient();

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const [monthData, properties, expiring] = await Promise.all([
    // Marketing sees only lease-ending events
    getCalendarMonth(year, month, { types: ["lease_ending"] }),
    supabase
      .from("property")
      .select("id, name")
      .is("archived_at", null)
      .order("name"),
    // Expiring within 90 days — the "upcoming vacancies" horizon
    getExpiringSoon(90, null),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        description="Upcoming lease endings and vacancies."
      />
      <CalendarShell
        initial={monthData}
        properties={properties.data ?? []}
        expiringCount={expiring.length}
        expiringDays={90}
        expiringHref="/marketing/calendar"
        allowedTypes={["lease_ending"]}
      />
    </div>
  );
}
