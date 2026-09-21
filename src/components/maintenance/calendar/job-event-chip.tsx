"use client";

import { cn } from "@/lib/utils/cn";
import { formatPHP } from "@/lib/utils/format-php";
import { JOB_EVENT_COLORS, type JobCalendarEvent } from "@/lib/maintenance/calendar-types";

export function JobEventChip({
  event,
  variant = "compact",
  onPreview,
}: {
  event: JobCalendarEvent;
  variant?: "compact" | "full";
  onPreview?: (e: JobCalendarEvent) => void;
}) {
  const colors = JOB_EVENT_COLORS[event.type];
  const isUrgent = event.priority === "urgent" && event.status !== "done" && event.status !== "cancelled";

  function handleClick(e: React.MouseEvent) {
    if (onPreview) {
      e.preventDefault();
      e.stopPropagation();
      onPreview(event);
    }
  }

  if (variant === "compact") {
    return (
      <button
        onClick={handleClick}
        className={cn(
          "group flex w-full items-center gap-1.5 truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium transition-all",
          colors.bg,
          colors.text,
          isUrgent && "ring-1 ring-danger-500/60 animate-pulse-slow"
        )}
        title={event.title}
      >
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", colors.dot)} />
        <span className="truncate">{event.title}</span>
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      className={cn(
        "flex w-full items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors hover:bg-ink-50 dark:hover:bg-white/[0.03]",
        colors.border,
        isUrgent && "ring-1 ring-danger-500/60"
      )}
    >
      <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", colors.dot)} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink-900">{event.title}</p>
        {event.subtitle && (
          <p className="truncate text-xs text-ink-500">{event.subtitle}</p>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {event.task_type_name && (
            <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-medium text-ink-600 dark:bg-white/[0.06]">
              {event.task_type_name}
            </span>
          )}
          <span className={cn(
            "rounded px-1.5 py-0.5 text-[10px] font-semibold capitalize",
            event.priority === "urgent" && "bg-danger-500/15 text-danger-700 dark:text-danger-500",
            event.priority === "high" && "bg-warning-500/15 text-warning-700 dark:text-warning-500",
            (event.priority === "normal" || event.priority === "low") && "bg-ink-100 text-ink-600 dark:bg-white/[0.06]"
          )}>
            {event.priority}
          </span>
        </div>
        {event.cost != null && (
          <p className="mt-1 text-xs font-semibold text-ink-700 dark:text-ink-600">
            {formatPHP(event.cost)}
          </p>
        )}
      </div>
    </button>
  );
}
