"use client";

import Link from "next/link";
import { X, ExternalLink, Calendar, Building2, User, Banknote, Tag } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/dashboard/status-pill";
import { formatPHP } from "@/lib/utils/format-php";
import { useDismissable } from "@/lib/hooks/use-dismissable";
import {
  JOB_EVENT_COLORS,
  JOB_EVENT_LABELS,
  PRIORITY_LABELS,
  type JobCalendarEvent,
} from "@/lib/maintenance/calendar-types";

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

const PRIORITY_TONE: Record<string, "gray" | "brand" | "yellow" | "red"> = {
  low: "gray",
  normal: "brand",
  high: "yellow",
  urgent: "red",
};

export function JobEventPreview({
  event,
  onClose,
}: {
  event: JobCalendarEvent | null;
  onClose: () => void;
}) {
  const ref = useDismissable({
    active: !!event,
    onDismiss: onClose,
    lockScroll: true,
  });

  if (!event) return null;
  const colors = JOB_EVENT_COLORS[event.type];
  const kind = String(event.meta?.kind ?? "created");
  const kindLabel =
    kind === "created" ? "Created" : kind === "scheduled" ? "Scheduled" : "Closed";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={ref}
        className="w-full max-w-md rounded-xl border border-ink-200 bg-surface shadow-lg dark:border-white/[0.08]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-ink-200 px-5 py-4 dark:border-white/[0.06]">
          <div className="flex items-start gap-3">
            <div className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", colors.bg)}>
              <span className={cn("h-2.5 w-2.5 rounded-full", colors.dot)} />
            </div>
            <div className="min-w-0">
              <p className={cn("text-xs font-medium uppercase tracking-wider", colors.text)}>
                {kindLabel} · {JOB_EVENT_LABELS[event.type]}
              </p>
              <p className="mt-0.5 text-base font-semibold text-ink-900">{event.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-white/[0.05]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          <Row icon={<Calendar className="h-4 w-4" />} label="Date" value={formatDate(event.date)} />
          {event.task_type_name && (
            <Row icon={<Tag className="h-4 w-4" />} label="Task" value={event.task_type_name} />
          )}
          {event.unit_number && (
            <Row icon={<Building2 className="h-4 w-4" />} label="Unit" value={event.unit_number} />
          )}
          {event.property_name && (
            <Row icon={<Building2 className="h-4 w-4" />} label="Property" value={event.property_name} />
          )}
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center text-ink-400">
              <User className="h-4 w-4" />
            </span>
            <div className="flex-1">
              <p className="text-xs text-ink-500">Priority</p>
              <StatusPill tone={PRIORITY_TONE[event.priority] ?? "gray"} dot>
                {PRIORITY_LABELS[event.priority]}
              </StatusPill>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center text-ink-400">
              <span className="text-sm font-semibold">●</span>
            </span>
            <div className="flex-1">
              <p className="text-xs text-ink-500">Status</p>
              <StatusPill
                tone={
                  colors.text.includes("danger")
                    ? "red"
                    : colors.text.includes("success")
                    ? "green"
                    : colors.text.includes("warning")
                    ? "yellow"
                    : "brand"
                }
                dot
              >
                {event.status.replace("_", " ")}
              </StatusPill>
            </div>
          </div>
          {event.cost != null && (
            <Row icon={<Banknote className="h-4 w-4" />} label="Cost estimate" value={formatPHP(event.cost)} highlight />
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-ink-200 px-5 py-3 dark:border-white/[0.06]">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          {event.href && (
            <Link href={event.href}>
              <Button>
                Open job order
                <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center text-ink-400">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-ink-500">{label}</p>
        <p className={cn("text-sm capitalize", highlight ? "font-semibold text-ink-900" : "text-ink-900")}>{value}</p>
      </div>
    </div>
  );
}
