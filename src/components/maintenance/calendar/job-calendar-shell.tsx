"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, List, Calendar as CalendarIcon, CalendarRange } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { JobMonthGrid } from "./job-month-grid";
import { JobWeekView } from "./job-week-view";
import { JobListView } from "./job-list-view";
import { JobDayPanel } from "./job-day-panel";
import { JobEventPreview } from "./job-event-preview";
import { JobLegend } from "./job-legend";
import { JobCalendarFilters } from "./job-calendar-filters";
import { JobExportMenu } from "./job-export-menu";
import type { JobCalendarEvent, JobCalendarMonth } from "@/lib/maintenance/calendar-types";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type ViewMode = "month" | "week" | "list";

export function JobCalendarShell({
  initial,
  properties,
}: {
  initial: JobCalendarMonth;
  properties: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [month, setMonth] = useState<JobCalendarMonth>(initial);
  const [view, setView] = useState<ViewMode>(
    (searchParams.get("view") as ViewMode) ?? "month"
  );
  const [anchorDate, setAnchorDate] = useState<string>(() => {
    const now = new Date();
    return (
      now.getFullYear() +
      "-" +
      String(now.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(now.getDate()).padStart(2, "0")
    );
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [preview, setPreview] = useState<JobCalendarEvent | null>(null);
  const [pending, setPending] = useState(false);

  const selectedProperty = searchParams.get("property");
  const statusesParam = searchParams.get("statuses") ?? "";
  const prioritiesParam = searchParams.get("priorities") ?? "";

  function updateQuery(next: {
    property?: string | null;
    statuses?: string | null;
    priorities?: string | null;
    view?: ViewMode;
  }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.property !== undefined) {
      if (next.property) params.set("property", next.property);
      else params.delete("property");
    }
    if (next.statuses !== undefined) {
      if (next.statuses) params.set("statuses", next.statuses);
      else params.delete("statuses");
    }
    if (next.priorities !== undefined) {
      if (next.priorities) params.set("priorities", next.priorities);
      else params.delete("priorities");
    }
    if (next.view !== undefined) params.set("view", next.view);
    router.replace(pathname + "?" + params.toString(), { scroll: false });
  }

  useEffect(() => {
    let cancelled = false;
    setPending(true);

    const params = new URLSearchParams();
    params.set("year", String(month.year));
    params.set("month", String(month.month));
    if (selectedProperty) params.set("property", selectedProperty);
    if (statusesParam) params.set("statuses", statusesParam);
    if (prioritiesParam) params.set("priorities", prioritiesParam);

    fetch("/api/maintenance/calendar/month?" + params.toString(), { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) {
          setMonth(data);
          setSelectedDate(null);
        }
      })
      .finally(() => {
        if (!cancelled) setPending(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProperty, statusesParam, prioritiesParam, month.year, month.month]);

  async function goToMonth(year: number, m: number) {
    setPending(true);
    try {
      const params = new URLSearchParams();
      params.set("year", String(year));
      params.set("month", String(m));
      if (selectedProperty) params.set("property", selectedProperty);
      if (statusesParam) params.set("statuses", statusesParam);
      if (prioritiesParam) params.set("priorities", prioritiesParam);

      const res = await fetch("/api/maintenance/calendar/month?" + params.toString(), { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as JobCalendarMonth;
        setMonth(data);
        setSelectedDate(null);
      }
    } finally {
      setPending(false);
    }
  }

  function prevMonth() {
    const m = month.month === 1 ? 12 : month.month - 1;
    const y = month.month === 1 ? month.year - 1 : month.year;
    goToMonth(y, m);
  }

  function nextMonth() {
    const m = month.month === 12 ? 1 : month.month + 1;
    const y = month.month === 12 ? month.year + 1 : month.year;
    goToMonth(y, m);
  }

  function today() {
    const now = new Date();
    goToMonth(now.getFullYear(), now.getMonth() + 1);
    setAnchorDate(
      now.getFullYear() +
        "-" +
        String(now.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(now.getDate()).padStart(2, "0")
    );
  }

  function shiftWeek(deltaDays: number) {
    const [y, m, d] = anchorDate.split("-").map(Number);
    const next = new Date(y, m - 1, d);
    next.setDate(next.getDate() + deltaDays);
    setAnchorDate(
      next.getFullYear() +
        "-" +
        String(next.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(next.getDate()).padStart(2, "0")
    );
  }

  const selectedEvents = selectedDate ? month.eventsByDate[selectedDate] ?? [] : [];

  return (
    <div className="space-y-4">
      <JobCalendarFilters properties={properties} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {view === "week" ? (
            <>
              <Button variant="secondary" size="icon" onClick={() => shiftWeek(-7)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="min-w-[260px] text-center text-lg font-semibold tracking-tight text-ink-900">
                Week of {new Date(anchorDate).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
              </h2>
              <Button variant="secondary" size="icon" onClick={() => shiftWeek(7)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" size="icon" onClick={prevMonth} disabled={pending}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="min-w-[180px] text-lg font-semibold tracking-tight text-ink-900">
                {MONTH_NAMES[month.month - 1]} {month.year}
              </h2>
              <Button variant="secondary" size="icon" onClick={nextMonth} disabled={pending}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}
          <Button variant="ghost" onClick={today} disabled={pending}>
            Today
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-ink-200 p-0.5 dark:border-white/[0.06]">
            <ViewButton active={view === "month"} onClick={() => { setView("month"); updateQuery({ view: "month" }); }} icon={<CalendarIcon className="h-3.5 w-3.5" />} label="Month" />
            <ViewButton active={view === "week"} onClick={() => { setView("week"); updateQuery({ view: "week" }); }} icon={<CalendarRange className="h-3.5 w-3.5" />} label="Week" />
            <ViewButton active={view === "list"} onClick={() => { setView("list"); updateQuery({ view: "list" }); }} icon={<List className="h-3.5 w-3.5" />} label="List" />
          </div>

          <JobExportMenu year={month.year} month={month.month} />
        </div>
      </div>

      <JobLegend />

      {view === "month" && (
        <JobMonthGrid
          month={month}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onPreview={setPreview}
        />
      )}

      {view === "week" && (
        <JobWeekView month={month} anchorDate={anchorDate} onPreview={setPreview} />
      )}

      {view === "list" && <JobListView month={month} />}

      <JobDayPanel
        date={selectedDate}
        events={selectedEvents}
        onClose={() => setSelectedDate(null)}
        onPreview={setPreview}
      />

      <JobEventPreview event={preview} onClose={() => setPreview(null)} />
    </div>
  );
}

function ViewButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-brand-500 text-white"
          : "text-ink-600 hover:bg-ink-100 dark:hover:bg-white/[0.05]"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
