"use client";

import { cn } from "@/lib/utils/cn";
import { formatPHP } from "@/lib/utils/format-php";
import { TYPE_COLORS, type CalendarEvent } from "@/lib/calendar/types";

/**
 * Which event types are draggable. Only lease events have a single
 * source date that can be meaningfully moved.
 */
function isDraggable(evt: CalendarEvent): boolean {
  return (
    (evt.type === "lease_starting" || evt.type === "lease_ending") &&
    !!evt.source_id
  );
}

export function DraggableChip({
  event,
  onPreview,
  onDragStart,
  onDragEnd,
}: {
  event: CalendarEvent;
  onPreview: (e: CalendarEvent) => void;
  onDragStart: (e: CalendarEvent) => void;
  onDragEnd: () => void;
}) {
  const colors = TYPE_COLORS[event.type];
  const isOverdue = event.type === "invoice_due" && event.status === "overdue";
  const draggable = isDraggable(event);

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    onPreview(event);
  }

  return (
    <button
      onClick={handleClick}
      draggable={draggable}
      onDragStart={(e) => {
        if (!draggable) {
          e.preventDefault();
          return;
        }
        e.stopPropagation();
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", event.id);
        onDragStart(event);
      }}
      onDragEnd={(e) => {
        e.stopPropagation();
        onDragEnd();
      }}
      className={cn(
        "group flex w-full items-center gap-1.5 truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium transition-all",
        colors.bg,
        colors.text,
        isOverdue && "ring-1 ring-danger-500/60 animate-pulse-slow",
        draggable && "cursor-grab active:cursor-grabbing hover:ring-1 hover:ring-brand-500/40"
      )}
      title={
        draggable
          ? event.title + " — drag to reschedule"
          : event.title
      }
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", colors.dot)} />
      <span className="truncate">{event.title}</span>
      {event.amount != null && (
        <span className="ml-auto shrink-0 text-[10px] font-semibold">
          {formatPHP(event.amount).replace("₱", "")}
        </span>
      )}
    </button>
  );
}
