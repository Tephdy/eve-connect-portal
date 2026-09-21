#!/usr/bin/env node
/**
 * Narrow sidebar rail width + kill horizontal overflow
 * Usage: node scaffold-sidebar-rail-width.mjs
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
// 1. globals.css — narrower rail width + overflow hidden on sidebar
// ---------------------------------------------------------------------------
FILES["src/app/globals.css"] =
`@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto,
    "Helvetica Neue", Arial, sans-serif;

  --surface:        255 255 255;
  --surface-muted:  247 249 252;
  --surface-sunken: 240 244 249;
  --surface-raised: 252 253 255;

  --ink-50:  248 250 252;
  --ink-100: 241 245 249;
  --ink-200: 226 232 240;
  --ink-300: 203 213 225;
  --ink-400: 148 163 184;
  --ink-500: 100 116 139;
  --ink-600: 71  85  105;
  --ink-700: 51  65  85;
  --ink-800: 30  41  59;
  --ink-900: 15  23  42;

  --sidebar-width: 16rem;

  color-scheme: light;
}

.dark {
  --surface:        13  20  36;
  --surface-muted:  9   14  26;
  --surface-sunken: 6   10  20;
  --surface-raised: 18  27  46;

  --ink-50:  9   14  26;
  --ink-100: 18  27  46;
  --ink-200: 30  41  66;
  --ink-300: 51  65  91;
  --ink-400: 116 132 159;
  --ink-500: 156 170 193;
  --ink-600: 190 201 219;
  --ink-700: 214 222 235;
  --ink-800: 235 240 248;
  --ink-900: 248 250 252;

  color-scheme: dark;
}

/* Rail mode: just wide enough for a 40px icon + 4px padding each side */
.app-shell[data-rail="true"] {
  --sidebar-width: 3.5rem;
}

* {
  border-color: rgb(var(--ink-200));
}

html, body {
  height: 100%;
  overflow: hidden;
}

body {
  background: rgb(var(--surface-muted));
  color: rgb(var(--ink-900));
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.dark body {
  background-image:
    radial-gradient(1200px 600px at 10% -10%, rgba(59, 111, 255, 0.06), transparent),
    radial-gradient(900px 500px at 100% 0%, rgba(34, 211, 238, 0.05), transparent);
  background-attachment: fixed;
}

::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background: rgb(var(--ink-300));
  border-radius: 9999px;
  border: 2px solid transparent;
  background-clip: content-box;
}
::-webkit-scrollbar-thumb:hover {
  background: rgb(var(--ink-400));
  background-clip: content-box;
}

* { scrollbar-width: thin; scrollbar-color: rgb(var(--ink-300)) transparent; }

:focus-visible {
  outline: 2px solid theme("colors.brand.500");
  outline-offset: 2px;
}

::selection {
  background: theme("colors.brand.200");
  color: theme("colors.brand.900");
}
.dark ::selection {
  background: theme("colors.brand.700");
  color: theme("colors.brand.50");
}

.app-shell {
  display: grid;
  grid-template-columns: var(--sidebar-width) 1fr;
  grid-template-rows: 4rem 1fr;
  grid-template-areas:
    "sidebar header"
    "sidebar main";
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  isolation: isolate;
  transition: grid-template-columns 200ms ease;
}

.app-sidebar {
  grid-area: sidebar;
  overflow: hidden;
  width: var(--sidebar-width);
  min-width: 0;
}

.app-header {
  grid-area: header;
  overflow: visible;
  position: relative;
  z-index: 30;
}

.app-main {
  grid-area: main;
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
  z-index: 10;
}

@media (max-width: 900px) {
  .app-shell {
    grid-template-columns: 1fr;
    grid-template-areas:
      "header"
      "main";
  }
  .app-sidebar { display: none; }
}

@media print {
  html, body { overflow: visible !important; height: auto !important; }
  .no-print { display: none !important; }
  .app-main { overflow: visible !important; }
}
`;

// ---------------------------------------------------------------------------
// 2. Sidebar — tighter rail layout, no horizontal scroll
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
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { UserRole } from "@/lib/auth/get-user-roles";
import { useSidebarState } from "@/lib/hooks/use-sidebar-state";
import { Tooltip } from "@/components/ui/tooltip";
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
  const { rail, openGroups, toggleRail, toggleGroup, openGroup, mounted } =
    useSidebarState();

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

  const allItems: NavItem[] = visibleGroups.flatMap((g) => g.items);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-surface">
      {/* Brand header */}
      <div
        className={cn(
          "flex h-16 shrink-0 items-center border-b border-ink-200/60 dark:border-white/[0.06]",
          rail ? "justify-center" : "px-4"
        )}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-gradient shadow-glow-sm">
          <span className="text-sm font-bold text-white">A</span>
        </div>
        {!rail && (
          <span className="ml-2.5 truncate text-[15px] font-semibold tracking-tight text-ink-900">
            Apartment Portal
          </span>
        )}
      </div>

      {/* Nav */}
      <nav
        className={cn(
          "flex-1 overflow-y-auto overflow-x-hidden",
          rail ? "py-3" : "px-3 py-4"
        )}
      >
        {rail ? (
          /* RAIL MODE — one 40px icon per row, centered */
          <div className="flex flex-col items-center gap-1">
            {allItems.map((item) => {
              const active = isItemActive(item);
              const Icon = item.icon;
              return (
                <Tooltip key={item.href} content={item.label} side="right">
                  <Link
                    href={item.href}
                    className={cn(
                      "group relative flex h-10 w-10 items-center justify-center rounded-lg transition-all",
                      active
                        ? "bg-brand-500/10 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"
                        : "text-ink-500 hover:bg-ink-100 hover:text-ink-900 dark:hover:bg-white/[0.04]"
                    )}
                    aria-label={item.label}
                  >
                    {active && (
                      <span className="absolute -left-2 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-500" />
                    )}
                    <Icon
                      className={cn(
                        "h-[18px] w-[18px] shrink-0",
                        active
                          ? "text-brand-500 dark:text-brand-400"
                          : "text-ink-400 group-hover:text-ink-600"
                      )}
                    />
                  </Link>
                </Tooltip>
              );
            })}
          </div>
        ) : (
          /* FULL MODE — collapsible groups */
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
                        "h-3 w-3 shrink-0 transition-transform",
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
                                "group relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-all",
                                active
                                  ? "bg-brand-500/10 font-medium text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"
                                  : "text-ink-600 hover:bg-ink-100 hover:text-ink-900 dark:hover:bg-white/[0.04]"
                              )}
                            >
                              {active && (
                                <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-500" />
                              )}
                              <Icon
                                className={cn(
                                  "h-[18px] w-[18px] shrink-0 transition-colors",
                                  active
                                    ? "text-brand-500 dark:text-brand-400"
                                    : "text-ink-400 group-hover:text-ink-600"
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
        )}
      </nav>

      {/* Footer */}
      <div
        className={cn(
          "shrink-0 border-t border-ink-200/60 dark:border-white/[0.06]",
          rail ? "flex flex-col items-center gap-2 py-3" : "space-y-2 p-3"
        )}
      >
        <button
          onClick={toggleRail}
          aria-label={rail ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "flex items-center rounded-lg text-sm text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900 dark:hover:bg-white/[0.04]",
            rail ? "h-10 w-10 justify-center" : "w-full gap-2.5 px-2.5 py-2"
          )}
        >
          {rail ? (
            <PanelLeftOpen className="h-[18px] w-[18px] shrink-0 text-ink-400" />
          ) : (
            <>
              <PanelLeftClose className="h-[18px] w-[18px] shrink-0 text-ink-400" />
              <span className="truncate">Collapse</span>
            </>
          )}
        </button>

        {mounted && (
          <UserMenu email={email} roles={roles} rail={rail} />
        )}
      </div>
    </div>
  );
}
`;

// ---------------------------------------------------------------------------
// 3. User menu — rail variant stays inside the rail width
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
  rail = false,
}: {
  email: string;
  roles: UserRole[];
  rail?: boolean;
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
        className={cn(
          "flex items-center rounded-lg transition-colors hover:bg-ink-100 dark:hover:bg-white/[0.04]",
          rail
            ? "h-10 w-10 justify-center"
            : "w-full gap-3 px-2 py-2 text-left"
        )}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-xs font-semibold text-white shadow-glow-sm">
          {initials || <UserIcon className="h-4 w-4" />}
        </div>
        {!rail && (
          <>
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
          </>
        )}
      </button>

      {open && (
        <div
          className={cn(
            "absolute z-50 rounded-lg border border-ink-200 bg-surface p-1.5 shadow-lg dark:border-white/[0.08] dark:bg-surface-raised",
            rail
              ? "bottom-0 left-full ml-2 w-64"
              : "bottom-full left-0 right-0 mb-2"
          )}
        >
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
// Runner
// ---------------------------------------------------------------------------
async function main() {
  const pkg = join(ROOT, "package.json");
  if (!(await exists(pkg))) {
    console.error("package.json not found. Run from project root.");
    process.exit(1);
  }

  console.log("Narrow sidebar rail + overflow fix\\n");

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
  console.log("\\nVerify:");
  console.log("  - Click Collapse → rail is exactly 3.5rem (56px) wide");
  console.log("  - Icons stack vertically, one per row");
  console.log("  - No horizontal scrollbar in the rail");
}
main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});