import { JobEventChip } from "./job-event-chip";
import { Card, CardBody } from "@/components/ui/card";
import type { JobCalendarMonth } from "@/lib/maintenance/calendar-types";

function formatDay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function JobListView({ month }: { month: JobCalendarMonth }) {
  const dates = Object.keys(month.eventsByDate).sort();

  if (dates.length === 0) {
    return (
      <Card>
        <CardBody className="py-16 text-center text-sm text-ink-500">
          No jobs this month.
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {dates.map((date) => {
        const events = month.eventsByDate[date];
        return (
          <Card key={date}>
            <CardBody className="p-0">
              <div className="border-b border-ink-200 px-5 py-2.5 dark:border-white/[0.06]">
                <p className="text-sm font-semibold text-ink-900">{formatDay(date)}</p>
                <p className="text-xs text-ink-500">
                  {events.length} job{events.length === 1 ? "" : "s"}
                </p>
              </div>
              <ul className="divide-y divide-ink-100 dark:divide-white/[0.04]">
                {events.map((e) => (
                  <li key={e.id}>
                    <JobEventChip event={e} variant="full" />
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}
