import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { formatPHP } from "@/lib/utils/format-php";
import {
  TYPE_COLORS,
  TYPE_LABELS,
  type CalendarEvent,
  type CalendarEventType,
  type CalendarMonth,
} from "@/lib/calendar/types";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-PH", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function MonthReport({
  month,
  propertyName,
}: {
  month: CalendarMonth;
  propertyName?: string;
}) {
  const counts: Record<CalendarEventType, number> = {
    rent_due: 0,
    invoice_due: 0,
    lease_starting: 0,
    lease_ending: 0,
    payment: 0,
  };
  let totalDue = 0;
  let totalPaid = 0;
  let overdue = 0;

  const dates = Object.keys(month.eventsByDate).sort();

  for (const date of dates) {
    for (const e of month.eventsByDate[date]) {
      counts[e.type]++;
      if (e.type === "rent_due" || e.type === "invoice_due") totalDue += e.amount ?? 0;
      if (e.type === "payment") totalPaid += e.amount ?? 0;
      if (e.type === "invoice_due" && e.status === "overdue") overdue++;
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900">
          {MONTHS[month.month - 1]} {month.year}
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          {propertyName ? propertyName + " · " : ""}Monthly calendar report
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <SummaryCard label="Total due" value={formatPHP(totalDue)} tone="warning" />
        <SummaryCard label="Total collected" value={formatPHP(totalPaid)} tone="success" />
        <SummaryCard label="Overdue" value={String(overdue)} tone="danger" />
        <SummaryCard
          label="Total events"
          value={String(Object.values(counts).reduce((s, n) => s + n, 0))}
          tone="brand"
        />
      </div>

      {/* Counts by type */}
      <Card>
        <CardHeader title="Events by type" />
        <CardBody>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {(Object.keys(counts) as CalendarEventType[]).map((t) => (
              <div key={t} className="flex items-center gap-2">
                <span className={cn("h-2 w-2 rounded-full", TYPE_COLORS[t].dot)} />
                <div>
                  <p className="text-xs text-ink-500">{TYPE_LABELS[t]}</p>
                  <p className="text-base font-semibold text-ink-900">{counts[t]}</p>
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Full event list */}
      <Card>
        <CardHeader title="All events" description={dates.length + " days with activity"} />
        <CardBody className="p-0">
          {dates.length === 0 ? (
            <p className="py-12 text-center text-sm text-ink-500">
              No events this month.
            </p>
          ) : (
            <ul className="divide-y divide-ink-100 dark:divide-white/[0.04]">
              {dates.map((date) => (
                <li key={date} className="px-5 py-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-500">
                    {formatDate(date)}
                  </p>
                  <ul className="space-y-1.5">
                    {month.eventsByDate[date].map((e) => (
                      <li key={e.id} className="flex items-start gap-2.5 text-sm">
                        <span
                          className={cn(
                            "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                            TYPE_COLORS[e.type].dot
                          )}
                        />
                        <span className="min-w-0 flex-1 text-ink-800">
                          {e.title}
                          {e.subtitle && (
                            <span className="text-ink-500"> · {e.subtitle}</span>
                          )}
                        </span>
                        {e.amount != null && (
                          <span className="shrink-0 font-medium text-ink-900">
                            {formatPHP(e.amount)}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <p className="text-center text-xs text-ink-400">
        Generated {new Date().toLocaleString("en-PH")}
      </p>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "success" | "warning" | "danger" | "brand";
}) {
  const colors = {
    success: "text-success-700 dark:text-success-500",
    warning: "text-warning-700 dark:text-warning-500",
    danger: "text-danger-700 dark:text-danger-500",
    brand: "text-brand-700 dark:text-brand-400",
  };
  return (
    <Card>
      <CardBody>
        <p className="text-xs text-ink-500">{label}</p>
        <p className={cn("mt-1 text-lg font-semibold", colors[tone])}>{value}</p>
      </CardBody>
    </Card>
  );
}

// Small util (inline to avoid import)
function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}
