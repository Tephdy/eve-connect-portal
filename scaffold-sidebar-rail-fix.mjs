#!/usr/bin/env node
/**
 * Fix sidebar rail mode:
 *   - One icon per line (block, not inline)
 *   - Lucide icons instead of font fallback
 * Usage: node scaffold-sidebar-rail-fix.mjs
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
// 1. Tooltip — make the wrapper block-level so it doesn't inline-collapse
// ---------------------------------------------------------------------------
FILES["src/components/ui/tooltip.tsx"] =
`"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";

export function Tooltip({
  content,
  children,
  side = "top",
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
}) {
  const [open, setOpen] = useState(false);

  const positions = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  return (
    <span
      className="relative block w-full"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          className={cn(
            "pointer-events-none absolute z-50 whitespace-nowrap rounded bg-ink-900 px-2 py-1 text-xs font-medium text-white shadow-md",
            positions[side]
          )}
        >
          {content}
        </span>
      )}
    </span>
  );
}
`;

// ---------------------------------------------------------------------------
// 2. Sidebar — rail mode renders one icon per row as block
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

  // Flatten all visible items — used in rail mode
  const allItems: NavItem[] = visibleGroups.flatMap((g) => g.items);

  return (
    <div className="flex h-full flex-col bg-surface">
      {/* Brand header */}
      <div
        className={cn(
          "flex h-16 shrink-0 items-center border-b border-ink-200/60 dark:border-white/[0.06]",
          rail ? "justify-center" : "px-4"
        )}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-gradient shadow-glow-sm">
          <span className="text-sm font-bold text-white">A</span>
        </div>
        {!rail && (
          <span className="ml-2.5 text-[15px] font-semibold tracking-tight text-ink-900">
            Apartment Portal
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className={cn("flex-1 overflow-y-auto py-4", rail ? "px-2" : "px-3")}>
        {rail ? (
          /* ---------- RAIL MODE: one icon per line ---------- */
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
          /* ---------- FULL MODE: collapsible groups ---------- */
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
          "shrink-0 space-y-2 border-t border-ink-200/60 dark:border-white/[0.06]",
          rail ? "px-2 py-3" : "p-3"
        )}
      >
        <button
          onClick={toggleRail}
          aria-label={rail ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "flex items-center rounded-lg text-sm text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900 dark:hover:bg-white/[0.04]",
            rail ? "mx-auto h-10 w-10 justify-center" : "w-full gap-2.5 px-2.5 py-2"
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
          <div className={rail ? "flex justify-center" : ""}>
            <UserMenu email={email} roles={roles} rail={rail} />
          </div>
        )}
      </div>
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

  console.log("Fix sidebar rail mode\\n");

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
  console.log("  - Click 'Collapse' → sidebar shrinks to rail");
  console.log("  - Icons render one per line");
  console.log("  - Hover any icon → tooltip with label appears");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});