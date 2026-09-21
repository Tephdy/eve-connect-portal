"use client";

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
        aria-label="User menu"
        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-all duration-150 hover:bg-ink-100 active:scale-[0.99] dark:hover:bg-white/[0.05]"
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-[10px] font-semibold text-white shadow-sm">
          {initials || <UserIcon className="h-3.5 w-3.5" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-ink-900">
            {email.split("@")[0]}
          </p>
          <p className="truncate text-[10px] text-ink-500">{roleSummary}</p>
        </div>
        <ChevronUp
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-ink-400 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 right-0 z-50 mb-2 rounded-lg border border-ink-200 bg-surface p-1.5 shadow-lg dark:border-white/[0.08] dark:bg-surface-raised">
          <div className="border-b border-ink-100 px-2.5 py-2 dark:border-white/[0.06]">
            <p className="truncate text-xs text-ink-500">Signed in as</p>
            <p className="truncate text-sm font-medium text-ink-900">{email}</p>
            <p className="mt-0.5 truncate text-[11px] text-ink-500">{roleSummary}</p>
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
