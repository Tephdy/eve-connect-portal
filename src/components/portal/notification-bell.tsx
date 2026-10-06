"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, X, AlertTriangle, Info, AlertOctagon, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { PortalNotification } from "@/lib/db/tenant-notifications";

const SEVERITY = {
  danger: { icon: AlertOctagon, color: "text-danger-600 dark:text-danger-500" },
  warning: { icon: AlertTriangle, color: "text-amber-600 dark:text-amber-500" },
  info: { icon: Info, color: "text-brand-600 dark:text-brand-400" },
} as const;

export function NotificationBell({
  notifications,
}: {
  notifications: PortalNotification[];
}) {
  const [open, setOpen] = useState(false);
  const count = notifications.length;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={
          count > 0
            ? count + " notification" + (count === 1 ? "" : "s")
            : "Notifications"
        }
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-ink-600 transition-colors hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-white/[0.06]"
      >
        <Bell className="h-[18px] w-[18px]" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-danger-500 px-1 text-[10px] font-bold text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="absolute inset-x-4 top-16 mx-auto max-w-md overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-xl dark:border-white/[0.08] dark:bg-[#16181e]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3 dark:border-white/[0.06]">
              <p className="text-sm font-semibold text-ink-900">
                Notifications
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-ink-400 hover:bg-ink-100 dark:hover:bg-white/[0.06]"
                aria-label="Close notifications"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {count === 0 ? (
              <div className="px-4 py-10 text-center">
                <Bell className="mx-auto h-6 w-6 text-ink-300" />
                <p className="mt-2 text-sm text-ink-500">
                  You&apos;re all caught up.
                </p>
              </div>
            ) : (
              <div className="max-h-[60vh] divide-y divide-ink-100 overflow-y-auto dark:divide-white/[0.04]">
                {notifications.map((n) => {
                  const s = SEVERITY[n.severity];
                  const Icon = s.icon;
                  return (
                    <Link
                      key={n.id}
                      href={n.href}
                      onClick={() => setOpen(false)}
                      className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-ink-50 dark:hover:bg-white/[0.02]"
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink-100 dark:bg-white/[0.06]",
                          s.color
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-ink-900">
                          {n.title}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-ink-500">
                          {n.body}
                        </p>
                      </div>
                      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-ink-300" />
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
