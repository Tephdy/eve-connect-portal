"use client";

import Link from "next/link";
import { X, ExternalLink, Calendar, Building2, Receipt, FileText, Send } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { formatPHP } from "@/lib/utils/format-php";
import { useDismissable } from "@/lib/hooks/use-dismissable";
import { TYPE_COLORS, TYPE_LABELS, type CalendarEvent } from "@/lib/calendar/types";

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function EventPreview({
  event,
  onClose,
}: {
  event: CalendarEvent | null;
  onClose: () => void;
}) {
  const ref = useDismissable({
    active: !!event,
    onDismiss: onClose,
    lockScroll: true,
  });

  if (!event) return null;
  const colors = TYPE_COLORS[event.type];

  const actions: { label: string; href: string; icon: React.ReactNode }[] = [];

  if (event.type === "invoice_due" && event.source_id) {
    actions.push({
      label: "Record payment",
      href: "/accounting/invoices/" + event.source_id,
      icon: <Receipt className="h-3.5 w-3.5" />,
    });
  }
  if ((event.type === "lease_starting" || event.type === "lease_ending") && event.source_id) {
    actions.push({
      label: "Open lease",
      href: "/property/leases/" + event.source_id,
      icon: <FileText className="h-3.5 w-3.5" />,
    });
  }
  if (event.type === "rent_due" && event.source_id) {
    actions.push({
      label: "Send reminder",
      href: "/property/leases/" + event.source_id,
      icon: <Send className="h-3.5 w-3.5" />,
    });
  }

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
                {TYPE_LABELS[event.type]}
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
          {event.subtitle && (
            <Row icon={<Building2 className="h-4 w-4" />} label="Tenant / Unit" value={event.subtitle} />
          )}
          {event.property_name && (
            <Row icon={<Building2 className="h-4 w-4" />} label="Property" value={event.property_name} />
          )}
          {event.amount != null && (
            <Row icon={<span className="text-sm font-semibold">₱</span>} label="Amount" value={formatPHP(event.amount)} highlight />
          )}
          {event.status && (
            <Row icon={<span className="text-sm font-semibold">●</span>} label="Status" value={event.status} />
          )}
        </div>

        {actions.length > 0 && (
          <div className="border-t border-ink-200 px-5 py-3 dark:border-white/[0.06]">
            <p className="mb-2 text-xs font-medium text-ink-500">Quick actions</p>
            <div className="flex flex-wrap gap-2">
              {actions.map((a) => (
                <Link key={a.label} href={a.href}>
                  <Button variant="secondary" size="sm">
                    {a.icon}
                    <span className="ml-1.5">{a.label}</span>
                  </Button>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-ink-200 px-5 py-3 dark:border-white/[0.06]">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          {event.href && (
            <Link href={event.href}>
              <Button>
                Open
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
        <p className={cn("text-sm capitalize", highlight ? "font-semibold text-success-700 dark:text-success-500" : "text-ink-900")}>
          {value}
        </p>
      </div>
    </div>
  );
}
