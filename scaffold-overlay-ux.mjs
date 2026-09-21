#!/usr/bin/env node
/**
 * Global overlay UX — ESC + click-outside + touch-outside for all overlays
 * Usage: node scaffold-overlay-ux.mjs
 *
 * Creates:
 *   src/lib/hooks/use-dismissable.ts
 *
 * Updates:
 *   src/components/ui/modal.tsx
 *   src/components/shell/notification-bell.tsx
 *   src/components/shell/role-badge.tsx
 *   src/components/shell/user-menu.tsx
 *   src/components/calendar/export-menu.tsx
 *   src/components/maintenance/calendar/job-export-menu.tsx
 *   src/components/calendar/event-preview.tsx
 *   src/components/maintenance/calendar/job-event-preview.tsx
 */

import { mkdir, writeFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import { join, dirname } from "node:path";

const ROOT = process.cwd();
const FILES = {};

async function exists(p) {
  try { await access(p, constants.F_OK); return true; } catch { return false; }
}

// =============================================================================
// 1. Shared hook
// =============================================================================
FILES["src/lib/hooks/use-dismissable.ts"] =
`"use client";

import { useEffect, useRef } from "react";

/**
 * Universal dismiss hook for overlays (modals, dropdowns, popovers).
 *
 * - Fires \`onDismiss\` when the user presses ESC
 * - Fires \`onDismiss\` when the user clicks/touches outside the ref element
 * - Blocks body scroll while active (pass \`lockScroll\` to disable)
 * - Handles touch events so mobile users get the same UX
 *
 * Usage:
 *   const ref = useDismissable({ active: open, onDismiss: () => setOpen(false) });
 *   return <div ref={ref}>...</div>;
 *
 * For overlays that render inline (like dropdowns in place), the hook
 * returns a ref you attach to the root container. Anything inside the
 * ref is considered "inside" — clicks there won't dismiss.
 */
export function useDismissable({
  active,
  onDismiss,
  lockScroll = false,
}: {
  active: boolean;
  onDismiss: () => void;
  lockScroll?: boolean;
}): React.RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement | null>(null);

  // ESC key
  useEffect(() => {
    if (!active) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onDismiss();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active, onDismiss]);

  // Click/touch outside
  useEffect(() => {
    if (!active) return;

    function onPointerDown(e: PointerEvent | MouseEvent | TouchEvent) {
      const el = ref.current;
      if (!el) return;

      const target = e.target as Node | null;
      if (!target) return;

      if (!el.contains(target)) {
        onDismiss();
      }
    }

    // Use pointerdown for unified mouse+touch handling on modern browsers.
    // Fall back to mousedown + touchstart for older Safari.
    const usePointer = typeof window !== "undefined" && "PointerEvent" in window;
    if (usePointer) {
      document.addEventListener("pointerdown", onPointerDown, true);
      return () => document.removeEventListener("pointerdown", onPointerDown, true);
    } else {
      document.addEventListener("mousedown", onPointerDown, true);
      document.addEventListener("touchstart", onPointerDown, true);
      return () => {
        document.removeEventListener("mousedown", onPointerDown, true);
        document.removeEventListener("touchstart", onPointerDown, true);
      };
    }
  }, [active, onDismiss]);

  // Optional scroll lock
  useEffect(() => {
    if (!active || !lockScroll) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [active, lockScroll]);

  return ref;
}
`;

// =============================================================================
// 2. Modal — use the hook, remove old ESC handler
// =============================================================================
FILES["src/components/ui/modal.tsx"] =
`"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useDismissable } from "@/lib/hooks/use-dismissable";

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const ref = useDismissable({
    active: open,
    onDismiss: onClose,
    lockScroll: true,
  });

  if (!open) return null;

  const widths = {
    sm: "max-w-sm",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-900/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={ref}
        className={cn("mt-16 w-full rounded-lg bg-surface shadow-lg", widths[size])}
      >
        <div className="flex items-start justify-between gap-4 border-b border-ink-200 px-5 py-4 dark:border-white/[0.06]">
          <div>
            <h2 className="font-semibold text-ink-900">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-ink-500">{description}</p>}
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-white/[0.05]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
`;

// =============================================================================
// 3. Notification bell
// =============================================================================
FILES["src/components/shell/notification-bell.tsx"] =
`"use client";

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
`;

// =============================================================================
// 4. Role badge
// =============================================================================
FILES["src/components/shell/role-badge.tsx"] =
`"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useDismissable } from "@/lib/hooks/use-dismissable";
import type { UserRole } from "@/lib/auth/get-user-roles";

const LABELS: Record<string, string> = {
  accounting: "Accounting",
  marketing: "Marketing",
  maintenance: "Maintenance",
  property_rep: "Property Rep",
  executive: "Executive",
  system_admin: "System Admin",
};

export function RolePill({ roles }: { roles: UserRole[] }) {
  const [open, setOpen] = useState(false);
  const ref = useDismissable({
    active: open,
    onDismiss: () => setOpen(false),
  });

  if (roles.length === 0) return null;

  const primary = roles[0];
  const primaryLabel = LABELS[primary.role_key] ?? primary.role_key;

  if (roles.length === 1) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-surface px-3 py-1 text-xs font-medium text-ink-700 dark:border-white/[0.06] dark:bg-white/[0.03] dark:text-ink-600">
        <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
        {primaryLabel}
      </span>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-surface px-3 py-1 text-xs font-medium text-ink-700 transition-colors hover:border-ink-300 dark:border-white/[0.06] dark:bg-white/[0.03] dark:text-ink-600 dark:hover:border-white/[0.10]"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
        {primaryLabel}
        <span className="text-ink-400">+{roles.length - 1}</span>
        <ChevronDown
          className={cn("h-3 w-3 text-ink-400 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 min-w-[180px] rounded-lg border border-ink-200 bg-surface p-1 shadow-lg dark:border-white/[0.08] dark:bg-surface-raised">
          {roles.map((r) => (
            <div
              key={r.role_key}
              className="rounded-md px-3 py-1.5 text-sm text-ink-700 dark:text-ink-600"
            >
              {LABELS[r.role_key] ?? r.role_key}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
`;

// =============================================================================
// 5. User menu (sidebar footer)
// =============================================================================
FILES["src/components/shell/user-menu.tsx"] =
`"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronUp, LogOut, User as UserIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { createClient } from "@/lib/supabase/client";
import { useDismissable } from "@/lib/hooks/use-dismissable";
import type { UserRole } from "@/lib/auth/get-user-roles";

const ROLE_LABELS: Record<string, string> = {
  accounting: "Accounting",
  marketing: "Marketing",
  maintenance: "Maintenance",
  property_rep: "Property Representative",
  executive: "Executive",
  system_admin: "System Admin",
};

export function UserMenu({
  email,
  roles,
}: {
  email: string;
  roles: UserRole[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useDismissable({
    active: open,
    onDismiss: () => setOpen(false),
  });

  const initials = email
    .split("@")[0]
    .split(/[._-]/)
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const roleSummary =
    roles.length === 0
      ? "No roles"
      : roles.length === 1
      ? ROLE_LABELS[roles[0].role_key] ?? roles[0].role_key
      : (ROLE_LABELS[roles[0].role_key] ?? roles[0].role_key) +
        " +" +
        (roles.length - 1);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors",
          "hover:bg-ink-100 dark:hover:bg-white/[0.04]"
        )}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-xs font-semibold text-white shadow-glow-sm">
          {initials || <UserIcon className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink-900">
            {email.split("@")[0]}
          </p>
          <p className="truncate text-[11px] text-ink-500">{roleSummary}</p>
        </div>
        <ChevronUp
          className={cn(
            "h-4 w-4 shrink-0 text-ink-400 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 right-0 z-50 mb-2 rounded-lg border border-ink-200 bg-surface p-1.5 shadow-lg dark:border-white/[0.08] dark:bg-surface-raised">
          <div className="border-b border-ink-100 px-2.5 py-2 dark:border-white/[0.06]">
            <p className="truncate text-xs text-ink-500">Signed in as</p>
            <p className="truncate text-sm font-medium text-ink-900">{email}</p>
          </div>
          <button
            onClick={signOut}
            className="mt-1 flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-danger-700 transition-colors hover:bg-danger-50 dark:text-danger-500 dark:hover:bg-danger-500/10"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
`;

// =============================================================================
// 6. Payment calendar export menu
// =============================================================================
FILES["src/components/calendar/export-menu.tsx"] =
`"use client";

import { useState } from "react";
import { Download, Printer, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDismissable } from "@/lib/hooks/use-dismissable";

export function ExportMenu({ year, month }: { year: number; month: number }) {
  const [open, setOpen] = useState(false);
  const ref = useDismissable({
    active: open,
    onDismiss: () => setOpen(false),
  });

  function downloadCsv() {
    const url = "/api/calendar/export?year=" + year + "&month=" + month;
    window.location.href = url;
    setOpen(false);
  }

  function printCalendar() {
    setOpen(false);
    setTimeout(() => window.print(), 100);
  }

  return (
    <div className="relative" ref={ref}>
      <Button variant="secondary" onClick={() => setOpen((v) => !v)}>
        <Download className="mr-1.5 h-3.5 w-3.5" />
        Export
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 min-w-[180px] rounded-lg border border-ink-200 bg-surface p-1 shadow-lg dark:border-white/[0.08] dark:bg-surface-raised">
          <button
            onClick={downloadCsv}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-ink-700 transition-colors hover:bg-ink-100 dark:text-ink-600 dark:hover:bg-white/[0.05]"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Download CSV
          </button>
          <button
            onClick={printCalendar}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-ink-700 transition-colors hover:bg-ink-100 dark:text-ink-600 dark:hover:bg-white/[0.05]"
          >
            <Printer className="h-4 w-4" />
            Print / Save PDF
          </button>
        </div>
      )}
    </div>
  );
}
`;

// =============================================================================
// 7. Job calendar export menu
// =============================================================================
FILES["src/components/maintenance/calendar/job-export-menu.tsx"] =
`"use client";

import { useState } from "react";
import { Download, Printer, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDismissable } from "@/lib/hooks/use-dismissable";

export function JobExportMenu({ year, month }: { year: number; month: number }) {
  const [open, setOpen] = useState(false);
  const ref = useDismissable({
    active: open,
    onDismiss: () => setOpen(false),
  });

  function downloadCsv() {
    const url = "/api/maintenance/calendar/export?year=" + year + "&month=" + month;
    window.location.href = url;
    setOpen(false);
  }

  function printCalendar() {
    setOpen(false);
    setTimeout(() => window.print(), 100);
  }

  return (
    <div className="relative" ref={ref}>
      <Button variant="secondary" onClick={() => setOpen((v) => !v)}>
        <Download className="mr-1.5 h-3.5 w-3.5" />
        Export
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 min-w-[180px] rounded-lg border border-ink-200 bg-surface p-1 shadow-lg dark:border-white/[0.08] dark:bg-surface-raised">
          <button
            onClick={downloadCsv}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-ink-700 transition-colors hover:bg-ink-100 dark:text-ink-600 dark:hover:bg-white/[0.05]"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Download CSV
          </button>
          <button
            onClick={printCalendar}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-ink-700 transition-colors hover:bg-ink-100 dark:text-ink-600 dark:hover:bg-white/[0.05]"
          >
            <Printer className="h-4 w-4" />
            Print / Save PDF
          </button>
        </div>
      )}
    </div>
  );
}
`;

// =============================================================================
// 8. Payment calendar event preview — ESC + click outside
// =============================================================================
FILES["src/components/calendar/event-preview.tsx"] =
`"use client";

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
`;

// =============================================================================
// 9. Job calendar event preview — ESC + click outside
// =============================================================================
FILES["src/components/maintenance/calendar/job-event-preview.tsx"] =
`"use client";

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
`;

// -----------------------------------------------------------------------------
// Runner
// -----------------------------------------------------------------------------
async function main() {
  const pkg = join(ROOT, "package.json");
  if (!(await exists(pkg))) {
    console.error("package.json not found. Run from project root.");
    process.exit(1);
  }

  console.log("Global overlay UX — ESC + click-outside\\n");

  let count = 0;
  for (const [relPath, content] of Object.entries(FILES)) {
    const full = join(ROOT, relPath);
    const exists_ = await exists(full);
    console.log((exists_ ? "  ~ " : "  + ") + relPath);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, content, "utf8");
    count++;
  }

  console.log("\\nDone — " + count + " file(s) written.\\n");
  console.log("Next:");
  console.log("  npm run typecheck");
  console.log("  npm run dev");
  console.log("\\nTry:");
  console.log("  - Open any dropdown → click outside → closes");
  console.log("  - Open any dropdown → press ESC → closes");
  console.log("  - Open a modal → click backdrop → closes");
  console.log("  - On mobile: tap outside → closes");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});