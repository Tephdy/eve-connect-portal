"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, AlertTriangle, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useDismissable } from "@/lib/hooks/use-dismissable";
import type { Reminder } from "@/lib/calendar/reminders";

const SEVERITY_ICON = {
  danger: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const SEVERITY_COLOR = {
  danger: "text-danger-600 dark:text-danger-500",
  warning: "text-warning-600 dark:text-warning-500",
  info: "text-info-600 dark:text-info-500",
};

export function NotificationBell({ reminders }: { reminders: Reminder[] }) {
  const [open, setOpen] = useState(false);
  const count = reminders.length;

  const ref = useDismissable({
    active: open,
    onDismiss: () => setOpen(false),
  });

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className="relative rounded-lg p-2 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900 dark:hover:bg-white/[0.05]"
      >
        <Bell className="h-[18px] w-[18px]" />
        {count > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-500 px-1 text-[10px] font-semibold text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border border-ink-200 bg-surface shadow-lg dark:border-white/[0.08] dark:bg-surface-raised">
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3 dark:border-white/[0.06]">
            <p className="text-sm font-semibold text-ink-900">Notifications</p>
            {count > 0 && (
              <span className="text-xs text-ink-500">
                {count} item{count === 1 ? "" : "s"}
              </span>
            )}
          </div>

          {count === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-ink-500">
              You&apos;re all caught up.
            </div>
          ) : (
            <ul className="max-h-96 divide-y divide-ink-100 overflow-y-auto dark:divide-white/[0.04]">
              {reminders.slice(0, 15).map((r) => {
                const Icon = SEVERITY_ICON[r.severity];
                return (
                  <li key={r.id}>
                    <Link
                      href={r.href}
                      onClick={() => setOpen(false)}
                      className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-ink-50 dark:hover:bg-white/[0.03]"
                    >
                      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", SEVERITY_COLOR[r.severity])} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink-900">{r.title}</p>
                        {r.subtitle && (
                          <p className="mt-0.5 truncate text-xs text-ink-500">{r.subtitle}</p>
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          {count > 15 && (
            <div className="border-t border-ink-100 px-4 py-2 text-center text-xs text-ink-500 dark:border-white/[0.06]">
              + {count - 15} more
            </div>
          )}
        </div>
      )}
    </div>
  );
}
