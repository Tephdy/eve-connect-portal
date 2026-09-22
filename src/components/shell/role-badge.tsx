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
      <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/60 bg-white/50 px-3 py-1.5 text-xs font-semibold text-ink-700 backdrop-blur-sm dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-ink-200">
        <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
        {primaryLabel}
      </span>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-xl border border-white/60 bg-white/50 px-3 py-1.5 text-xs font-semibold text-ink-700 backdrop-blur-sm transition-all hover:border-white/80 hover:bg-white/70 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-ink-200 dark:hover:bg-white/[0.08]"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
        {primaryLabel}
        <span className="text-ink-400">+{roles.length - 1}</span>
        <ChevronDown
          className={cn("h-3 w-3 text-ink-400 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="glass-strong absolute right-0 top-full z-50 mt-2 min-w-[180px] rounded-xl p-1.5">
          {roles.map((r) => (
            <div
              key={r.role_key}
              className="rounded-lg px-3 py-1.5 text-sm text-ink-700 dark:text-ink-300"
            >
              {LABELS[r.role_key] ?? r.role_key}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
