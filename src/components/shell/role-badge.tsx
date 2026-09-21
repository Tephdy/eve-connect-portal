"use client";

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
