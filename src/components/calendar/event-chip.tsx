"use client";

import { cn } from "@/lib/utils/cn";
import { formatPHP } from "@/lib/utils/format-php";
import { TYPE_COLORS, type CalendarEvent } from "@/lib/calendar/types";

export function EventChip({
  event,
  variant = "compact",
  onPreview,
}: {
  event: CalendarEvent;
  variant?: "compact" | "full";
  onPreview?: (e: CalendarEvent) => void;
}) {
  const colors = TYPE_COLORS[event.type];
  const isOverdue = event.type === "invoice_due" && event.status === "overdue";

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
          "group flex w-full items-center gap-1.5 truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium",
          colors.bg,
          colors.text,
          isOverdue && "ring-1 ring-danger-500/60 animate-pulse-slow"
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
        isOverdue && "ring-1 ring-danger-500/60"
      )}
    >
      <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", colors.dot)} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink-900">{event.title}</p>
        {event.subtitle && (
          <p className="truncate text-xs text-ink-500">{event.subtitle}</p>
        )}
        {event.amount != null && (
          <p className={cn("mt-0.5 text-xs font-semibold", colors.text)}>
            {formatPHP(event.amount)}
          </p>
        )}
      </div>
    </button>
  );
}
