"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  List,
  Calendar as CalendarIcon,
  CalendarRange,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { MonthGrid } from "./month-grid";
import { WeekView } from "./week-view";
import { ListView } from "./list-view";
import { DayPanel } from "./day-panel";
import { EventPreview } from "./event-preview";
import { Legend } from "./legend";
import { CalendarFilters } from "./calendar-filters";
import { ExpiringBanner } from "./expiring-banner";
import { ExportMenu } from "./export-menu";
import { rescheduleLeaseAction } from "@/app/(dashboard)/accounting/calendar/actions";
import {
  ALL_TYPES,
  type CalendarEvent,
  type CalendarEventType,
  type CalendarMonth,
  type ViewMode,
} from "@/lib/calendar/types";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function CalendarShell({
  initial,
  properties,
  expiringCount,
  expiringDays,
  expiringHref,
}: {
  initial: CalendarMonth;
  properties: { id: string; name: string }[];
  expiringCount: number;
  expiringDays: number;
  expiringHref: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const toast = useToast();

  const [month, setMonth] = useState<CalendarMonth>(initial);
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
  const [preview, setPreview] = useState<CalendarEvent | null>(null);
  const [pending, start] = useTransition();

  const selectedProperty = searchParams.get("property");
  const typesParam = searchParams.get("types") ?? "";
  const selectedTypes: CalendarEventType[] = typesParam
    ? (typesParam.split(",").filter((t) => ALL_TYPES.includes(t as CalendarEventType)) as CalendarEventType[])
    : [];

  function updateQuery(next: {
    property?: string | null;
    types?: CalendarEventType[];
    view?: ViewMode;
  }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.property !== undefined) {
      if (next.property) params.set("property", next.property);
      else params.delete("property");
    }
    if (next.types !== undefined) {
      if (next.types.length > 0) params.set("types", next.types.join(","));
      else params.delete("types");
    }
    if (next.view !== undefined) params.set("view", next.view);
    router.replace(pathname + "?" + params.toString(), { scroll: false });
  }

  useEffect(() => {
    let cancelled = false;

    const params = new URLSearchParams();
    params.set("year", String(month.year));
    params.set("month", String(month.month));
    if (selectedProperty) params.set("property", selectedProperty);
    if (selectedTypes.length > 0) params.set("types", selectedTypes.join(","));

    fetch("/api/calendar/month?" + params.toString(), { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) {
          setMonth(data);
          setSelectedDate(null);
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProperty, typesParam, month.year, month.month]);

  async function goToMonth(year: number, m: number) {
    const params = new URLSearchParams();
    params.set("year", String(year));
    params.set("month", String(m));
    if (selectedProperty) params.set("property", selectedProperty);
    if (selectedTypes.length > 0) params.set("types", selectedTypes.join(","));

    const res = await fetch("/api/calendar/month?" + params.toString(), {
      cache: "no-store",
    });
    if (res.ok) {
      const data = (await res.json()) as CalendarMonth;
      setMonth(data);
      setSelectedDate(null);
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

  function handleDropEvent(event: CalendarEvent, newDate: string) {
    if (!event.source_id) {
      toast.push("This event cannot be rescheduled", "error");
      return;
    }
    if (event.type !== "lease_starting" && event.type !== "lease_ending") {
      toast.push("Only lease events can be rescheduled", "error");
      return;
    }

    const field = event.type === "lease_starting" ? "start_date" : "end_date";

    start(async () => {
      const result = await rescheduleLeaseAction({
        lease_id: event.source_id!,
        field,
        new_date: newDate,
      });
      if (result.ok) {
        toast.push("Lease rescheduled", "success");
        // Refetch current month
        goToMonth(month.year, month.month);
      } else {
        toast.push(result.error, "error");
      }
    });
  }

  const selectedEvents = selectedDate ? month.eventsByDate[selectedDate] ?? [] : [];

  return (
    <div className="space-y-4">
      <ExpiringBanner count={expiringCount} days={expiringDays} href={expiringHref} />

      <CalendarFilters
        properties={properties}
        selectedProperty={selectedProperty}
        onPropertyChange={(id) => updateQuery({ property: id })}
        selectedTypes={selectedTypes}
        onTypesChange={(t) => updateQuery({ types: t })}
      />

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
          <Button variant="ghost" onClick={today}>
            Today
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {/* View switcher */}
          <div className="flex rounded-lg border border-ink-200 p-0.5 dark:border-white/[0.06]">
            <ViewButton
              active={view === "month"}
              onClick={() => { setView("month"); updateQuery({ view: "month" }); }}
              icon={<CalendarIcon className="h-3.5 w-3.5" />}
              label="Month"
            />
            <ViewButton
              active={view === "week"}
              onClick={() => { setView("week"); updateQuery({ view: "week" }); }}
              icon={<CalendarRange className="h-3.5 w-3.5" />}
              label="Week"
            />
            <ViewButton
              active={view === "list"}
              onClick={() => { setView("list"); updateQuery({ view: "list" }); }}
              icon={<List className="h-3.5 w-3.5" />}
              label="List"
            />
          </div>

          {/* Report link */}
          <Link
            href={
              "/accounting/calendar/report?year=" +
              month.year +
              "&month=" +
              month.month +
              (selectedProperty ? "&property=" + selectedProperty : "")
            }
          >
            <Button variant="secondary">
              <FileText className="mr-1.5 h-3.5 w-3.5" />
              Report
            </Button>
          </Link>

          <ExportMenu year={month.year} month={month.month} />
        </div>
      </div>

      <Legend />

      {view === "month" && (
        <MonthGrid
          month={month}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onPreview={setPreview}
          onDropEvent={handleDropEvent}
        />
      )}

      {view === "week" && (
        <WeekView
          month={month}
          anchorDate={anchorDate}
          onPreview={setPreview}
          onDropEvent={handleDropEvent}
        />
      )}

      {view === "list" && <ListView month={month} />}

      <DayPanel
        date={selectedDate}
        events={selectedEvents}
        onClose={() => setSelectedDate(null)}
        onPreview={setPreview}
      />

      <EventPreview event={preview} onClose={() => setPreview(null)} />
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
