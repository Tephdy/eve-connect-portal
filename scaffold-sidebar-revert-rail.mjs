#!/usr/bin/env node
/**
 * Revert rail toggle — keep the new design
 * Usage: node scaffold-sidebar-revert-rail.mjs
 *
 * Rewrites:
 *   src/components/shell/dashboard-shell.tsx  (fixed 16rem, no rail)
 *   src/components/shell/sidebar.tsx          (no rail toggle, groups + design only)
 *   src/components/shell/user-menu.tsx        (no rail prop)
 *   src/lib/hooks/use-sidebar-state.ts        (rail field kept but ignored)
 */

import { writeFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

async function exists(p) {
  try { await access(p, constants.F_OK); return true; } catch { return false; }
}

const FILES = {};

// ---------------------------------------------------------------------------
// 1. Dashboard shell — fixed width, no rail state
// ---------------------------------------------------------------------------
FILES["src/components/shell/dashboard-shell.tsx"] =
`"use client";

export function DashboardShell({
  sidebar,
  topbar,
  children,
}: {
  sidebar: React.ReactNode;
  topbar: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="app-shell-v2" style={{ gridTemplateColumns: "16rem 1fr" }}>
      <aside className="app-sidebar-v2">{sidebar}</aside>
      <header className="app-header-v2">{topbar}</header>
      <main className="app-main-v2">
        <div className="mx-auto max-w-[1500px] p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
`;

// ---------------------------------------------------------------------------
// 2. Sidebar — no rail, keep collapsible groups + design
// ---------------------------------------------------------------------------
FILES["src/components/shell/sidebar.tsx"] =
`"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import {
  LayoutDashboard,
  Building2,
  DoorOpen,
  Users,
  FileText,
  ScrollText,
  FileSignature,
  Wrench,
  Package,
  Settings2,
  Megaphone,
  ListChecks,
  MessageSquare,
  Receipt,
  CreditCard,
  Wallet,
  CheckSquare,
  BarChart3,
  ShieldCheck,
  Calendar as CalendarIcon,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { UserRole } from "@/lib/auth/get-user-roles";
import { useSidebarState } from "@/lib/hooks/use-sidebar-state";
import { UserMenu } from "./user-menu";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: string[];
  exact?: boolean;
};

type NavGroup = { label: string; roles: string[]; items: NavItem[] };

const GROUPS: NavGroup[] = [
  {
    label: "Overview",
    roles: ["*"],
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["*"], exact: true },
    ],
  },
  {
    label: "Property",
    roles: ["property_rep", "executive", "marketing", "maintenance"],
    items: [
      { href: "/property/properties", label: "Properties", icon: Building2, roles: ["property_rep", "executive"] },
      { href: "/property/units",      label: "Units",      icon: DoorOpen, roles: ["property_rep", "executive", "marketing", "maintenance"] },
      { href: "/property/tenants",    label: "Tenants",    icon: Users, roles: ["property_rep", "executive"] },
      { href: "/property/leases",     label: "Leases",     icon: FileText, roles: ["property_rep", "executive"] },
      { href: "/property/calendar",   label: "Calendar",   icon: CalendarIcon, roles: ["property_rep", "executive"] },
      { href: "/property/contracts",  label: "Contracts",  icon: FileSignature, roles: ["property_rep", "executive"] },
      { href: "/property/templates",  label: "Templates",  icon: ScrollText, roles: ["property_rep", "executive"] },
    ],
  },
  {
    label: "Marketing",
    roles: ["marketing", "executive"],
    items: [
      { href: "/marketing",           label: "Overview",  icon: BarChart3, roles: ["marketing", "executive"], exact: true },
      { href: "/marketing/listings",  label: "Listings",  icon: Megaphone, roles: ["marketing", "executive"] },
      { href: "/marketing/forecast",  label: "Forecast",  icon: ListChecks, roles: ["marketing", "executive", "property_rep"] },
      { href: "/marketing/inquiries", label: "Inquiries", icon: MessageSquare, roles: ["marketing", "executive"] },
    ],
  },
  {
    label: "Accounting",
    roles: ["accounting", "executive"],
    items: [
      { href: "/accounting",           label: "Overview",  icon: BarChart3, roles: ["accounting", "executive"], exact: true },
      { href: "/accounting/calendar",  label: "Calendar",  icon: CalendarIcon, roles: ["accounting", "executive"] },
      { href: "/accounting/invoices",  label: "Invoices",  icon: Receipt, roles: ["accounting", "executive"] },
      { href: "/accounting/payments",  label: "Payments",  icon: CreditCard, roles: ["accounting", "executive"] },
      { href: "/accounting/deposits",  label: "Deposits",  icon: Wallet, roles: ["accounting", "executive"] },
      { href: "/accounting/approvals", label: "Approvals", icon: CheckSquare, roles: ["accounting", "executive"] },
    ],
  },
  {
    label: "Maintenance",
    roles: ["maintenance", "executive", "property_rep"],
    items: [
      { href: "/maintenance",            label: "Job Orders", icon: Wrench, roles: ["maintenance", "executive", "property_rep"], exact: true },
      { href: "/maintenance/calendar",   label: "Calendar",   icon: CalendarIcon, roles: ["maintenance", "executive", "property_rep"] },
      { href: "/maintenance/assets",     label: "Assets",     icon: Package, roles: ["maintenance", "executive"] },
      { href: "/maintenance/task-types", label: "Task Types", icon: Settings2, roles: ["executive"] },
    ],
  },
  {
    label: "Admin",
    roles: ["executive", "system_admin"],
    items: [
      { href: "/executive", label: "Executive",    icon: BarChart3, roles: ["executive"] },
      { href: "/admin",     label: "System Admin", icon: ShieldCheck, roles: ["system_admin"] },
    ],
  },
];

export function Sidebar({
  roles,
  email,
}: {
  roles: UserRole[];
  email: string;
}) {
  const pathname = usePathname();
  const keys = roles.map((r) => r.role_key);
  const { openGroups, toggleGroup, openGroup, mounted } = useSidebarState();

  const visibleGroups: NavGroup[] = GROUPS.map((g) => {
    if (!g.roles.includes("*") && !g.roles.some((r) => keys.includes(r))) return null;
    const items = g.items.filter(
      (item) => item.roles.includes("*") || item.roles.some((r) => keys.includes(r))
    );
    if (items.length === 0) return null;
    return { ...g, items };
  }).filter((g): g is NavGroup => g !== null);

  useEffect(() => {
    if (!mounted) return;
    const currentGroup = visibleGroups.find((g) =>
      g.items.some((item) => {
        if (item.exact) return pathname === item.href;
        return pathname === item.href || pathname.startsWith(item.href + "/");
      })
    );
    if (currentGroup && !openGroups.includes(currentGroup.label)) {
      openGroup(currentGroup.label);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, mounted]);

  function isItemActive(item: NavItem) {
    if (item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(item.href + "/");
  }

  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden"
      style={{ background: "rgb(var(--sidebar-bg))" }}
    >
      {/* Brand header */}
      <div className="flex h-16 shrink-0 items-center border-b border-ink-200/40 px-4 dark:border-white/[0.05]">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-gradient shadow-glow-sm">
          <span className="text-sm font-bold text-white">A</span>
        </div>
        <span className="ml-2.5 truncate text-[15px] font-semibold tracking-tight text-ink-900">
          Apartment Portal
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4">
        <div className="space-y-3">
          {visibleGroups.map((g) => {
            const isOpen = openGroups.includes(g.label);
            const hasActive = g.items.some(isItemActive);

            return (
              <div key={g.label}>
                <button
                  onClick={() => toggleGroup(g.label)}
                  className={cn(
                    "group flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors",
                    hasActive && !isOpen
                      ? "text-brand-600 dark:text-brand-400"
                      : "text-ink-400 hover:text-ink-600"
                  )}
                >
                  <span className="truncate">{g.label}</span>
                  <ChevronDown
                    className={cn(
                      "h-3 w-3 shrink-0 transition-transform duration-200",
                      isOpen && "rotate-180"
                    )}
                  />
                </button>

                {isOpen && (
                  <ul className="mt-1 space-y-0.5">
                    {g.items.map((item) => {
                      const active = isItemActive(item);
                      const Icon = item.icon;
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            className={cn(
                              "group relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-all duration-150",
                              active
                                ? "bg-brand-500/12 font-medium text-brand-700 dark:bg-brand-500/20 dark:text-brand-300"
                                : "text-ink-600 hover:bg-ink-100/80 hover:text-ink-900 dark:hover:bg-white/[0.05]"
                            )}
                          >
                            {active && (
                              <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-500" />
                            )}
                            <Icon
                              className={cn(
                                "h-[17px] w-[17px] shrink-0 transition-transform duration-150",
                                active
                                  ? "text-brand-500 dark:text-brand-400"
                                  : "text-ink-400 group-hover:text-ink-700 group-hover:scale-105 dark:group-hover:text-ink-800"
                              )}
                            />
                            <span className="truncate">{item.label}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      {/* Footer — user menu only */}
      <div className="shrink-0 border-t border-ink-200/40 p-2 dark:border-white/[0.05]">
        {mounted && <UserMenu email={email} roles={roles} />}
      </div>
    </div>
  );
}
`;

// ---------------------------------------------------------------------------
// 3. User menu — no rail prop
// ---------------------------------------------------------------------------
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
`;

// ---------------------------------------------------------------------------
// 4. Sidebar state hook — drop rail entirely (only groups matter now)
// ---------------------------------------------------------------------------
FILES["src/lib/hooks/use-sidebar-state.ts"] =
`"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "apartment-portal-sidebar-state-v2";

type SidebarState = {
  openGroups: string[];
};

const DEFAULT_STATE: SidebarState = {
  openGroups: ["Overview"],
};

function read(): SidebarState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<SidebarState>;
    return {
      openGroups: Array.isArray(parsed.openGroups)
        ? parsed.openGroups
        : DEFAULT_STATE.openGroups,
    };
  } catch {
    return DEFAULT_STATE;
  }
}

function write(state: SidebarState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota errors
  }
}

export function useSidebarState() {
  const [state, setState] = useState<SidebarState>(DEFAULT_STATE);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setState(read());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) write(state);
  }, [state, mounted]);

  const toggleGroup = useCallback((label: string) => {
    setState((s) => {
      const set = new Set(s.openGroups);
      if (set.has(label)) set.delete(label);
      else set.add(label);
      return { ...s, openGroups: Array.from(set) };
    });
  }, []);

  const openGroup = useCallback((label: string) => {
    setState((s) => {
      if (s.openGroups.includes(label)) return s;
      return { ...s, openGroups: [...s.openGroups, label] };
    });
  }, []);

  return {
    openGroups: state.openGroups,
    toggleGroup,
    openGroup,
    mounted,
  };
}
`;

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------
async function main() {
  const pkg = join(ROOT, "package.json");
  if (!(await exists(pkg))) {
    console.error("package.json not found. Run from project root.");
    process.exit(1);
  }

  console.log("Revert rail toggle — keep the new design\\n");

  let count = 0;
  for (const [relPath, content] of Object.entries(FILES)) {
    const full = join(ROOT, relPath);
    const exists_ = await exists(full);
    console.log((exists_ ? "  ~ " : "  + ") + relPath);
    await writeFile(full, content, "utf8");
    count++;
  }

  console.log("\\nDone — " + count + " file(s) written.\\n");
  console.log("Next:");
  console.log("  npm run typecheck");
  console.log("  npm run dev");
  console.log("\\nWhat remains:");
  console.log("  - Collapsible department groups (Overview, Property, Marketing, ...)");
  console.log("  - New sidebar background color (soft slate)");
  console.log("  - Solid brand active item + left accent bar");
  console.log("  - Hover: subtle background + icon scale");
  console.log("  - Fixed 16rem width — no rail toggle");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});