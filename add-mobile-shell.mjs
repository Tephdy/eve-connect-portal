#!/usr/bin/env node
/**
 * add-mobile-shell.mjs
 * Adds a native-app-style mobile shell:
 *   - Mobile top bar with hamburger
 *   - Slide-in drawer (reuses existing Sidebar)
 *   - Role-aware bottom navigation (5 tabs)
 *   - Safe-area insets, PWA meta, native polish
 * Breakpoint: < 900px (matches existing CSS)
 *
 * Usage: node add-mobile-shell.mjs [--dry]
 */
import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import { join, dirname } from "node:path";

const DRY = process.argv.includes("--dry");
const ROOT = process.cwd();

async function exists(p) {
  try { await access(p, constants.F_OK); return true; } catch { return false; }
}
async function writeFileSafe(rel, content) {
  const full = join(ROOT, rel);
  if (DRY) { console.log("  ~ would write: " + rel); return; }
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, content, "utf8");
  console.log("  + wrote: " + rel);
}
async function patchFile(rel, mutate) {
  const full = join(ROOT, rel);
  if (!(await exists(full))) { console.log("  ! missing: " + rel); return; }
  const before = await readFile(full, "utf8");
  const after = mutate(before);
  if (after === before) { console.log("  = no change: " + rel); return; }
  if (DRY) { console.log("  ~ would patch: " + rel); return; }
  await writeFile(full, after, "utf8");
  console.log("  + patched: " + rel);
}

// ===========================================================================
// 1. src/components/shell/mobile-drawer.tsx
// ===========================================================================

const DRAWER = `"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function MobileDrawer({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Lock body scroll while open
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  // Escape closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Basic focus management
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-[100] lg:hidden",
        open ? "pointer-events-auto" : "pointer-events-none"
      )}
      aria-hidden={!open}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-black/50 transition-opacity duration-200",
          open ? "opacity-100" : "opacity-0"
        )}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        className={cn(
          "absolute left-0 top-0 h-full w-[85vw] max-w-[320px] bg-surface shadow-2xl outline-none",
          "transition-transform duration-250 ease-out",
          open ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ transitionDuration: "250ms" }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close menu"
          className="absolute right-3 top-3 z-10 rounded-xl p-2 text-ink-500 hover:bg-white/60 dark:hover:bg-white/[0.06]"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="h-full overflow-y-auto overscroll-contain">
          {children}
        </div>
      </div>
    </div>
  );
}
`;

await writeFileSafe("src/components/shell/mobile-drawer.tsx", DRAWER);

// ===========================================================================
// 2. src/components/shell/mobile-bottom-nav.tsx
// ===========================================================================

const BOTTOM_NAV = `"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  CreditCard,
  ClipboardCheck,
  Menu as MenuIcon,
  Building2,
  BarChart3,
  DoorOpen,
  FileText,
  Users,
  Wrench,
  Package,
  Calendar as CalendarIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { UserRole } from "@/lib/auth/get-user-roles";

type Tab = {
  key: string;
  href?: string;
  label: string;
  icon: LucideIcon;
};

const ACCOUNTING_TABS: Tab[] = [
  { key: "overview", href: "/dashboard",          label: "Home",     icon: LayoutDashboard },
  { key: "invoices", href: "/accounting/invoices", label: "Invoices", icon: Receipt },
  { key: "payments", href: "/accounting/payments", label: "Payments", icon: CreditCard },
  { key: "audit",    href: "/accounting/audit",    label: "Audit",    icon: ClipboardCheck },
  { key: "more",     label: "More",                icon: MenuIcon },
];

const EXECUTIVE_TABS: Tab[] = [
  { key: "home",       href: "/dashboard",          label: "Home",     icon: LayoutDashboard },
  { key: "properties", href: "/property/properties", label: "Properties", icon: Building2 },
  { key: "accounting", href: "/accounting",         label: "Accounting", icon: BarChart3 },
  { key: "audit",      href: "/accounting/audit",   label: "Audit",    icon: ClipboardCheck },
  { key: "more",       label: "More",               icon: MenuIcon },
];

const PROPERTY_TABS: Tab[] = [
  { key: "home",    href: "/dashboard",         label: "Home",    icon: LayoutDashboard },
  { key: "units",   href: "/property/units",    label: "Units",   icon: DoorOpen },
  { key: "leases",  href: "/property/leases",   label: "Leases",  icon: FileText },
  { key: "tenants", href: "/property/tenants",  label: "Tenants", icon: Users },
  { key: "more",    label: "More",              icon: MenuIcon },
];

const MAINTENANCE_TABS: Tab[] = [
  { key: "jobs",     href: "/maintenance",          label: "Jobs",     icon: Wrench },
  { key: "assets",   href: "/maintenance/assets",   label: "Assets",   icon: Package },
  { key: "calendar", href: "/maintenance/calendar", label: "Calendar", icon: CalendarIcon },
  { key: "more",     label: "More",                 icon: MenuIcon },
];

function tabsForRoles(keys: string[]): Tab[] {
  if (keys.includes("accounting")) return ACCOUNTING_TABS;
  if (keys.includes("executive"))  return EXECUTIVE_TABS;
  if (keys.includes("property_rep")) return PROPERTY_TABS;
  if (keys.includes("maintenance"))  return MAINTENANCE_TABS;
  return ACCOUNTING_TABS;
}

export function MobileBottomNav({
  roles,
  onMore,
}: {
  roles: UserRole[];
  onMore: () => void;
}) {
  const pathname = usePathname();
  const keys = roles.map((r) => r.role_key);
  const tabs = tabsForRoles(keys);

  function isActive(t: Tab): boolean {
    if (!t.href) return false;
    if (t.href === "/dashboard") return pathname === "/dashboard";
    return pathname === t.href || pathname.startsWith(t.href + "/");
  }

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[90] lg:hidden"
      style={{
        paddingBottom: "env(safe-area-inset-bottom)",
        background: "rgb(var(--surface-raised) / 0.92)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderTop: "1px solid rgb(var(--ink-200) / 0.4)",
      }}
      aria-label="Primary navigation"
    >
      <ul className="flex h-16 items-stretch">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = isActive(t);
          const content = (
            <>
              <Icon
                className={cn(
                  "h-5 w-5 transition-transform duration-150",
                  active ? "scale-110 text-brand-600 dark:text-brand-400" : "text-ink-500"
                )}
              />
              <span
                className={cn(
                  "mt-0.5 text-[10px] font-semibold tracking-tight transition-colors",
                  active ? "text-brand-600 dark:text-brand-400" : "text-ink-500"
                )}
              >
                {t.label}
              </span>
            </>
          );

          return (
            <li key={t.key} className="flex-1">
              {t.href ? (
                <Link
                  href={t.href}
                  className="flex h-full flex-col items-center justify-center gap-0.5 select-none active:opacity-60 transition-opacity"
                >
                  {content}
                </Link>
              ) : (
                <button
                  onClick={onMore}
                  className="flex h-full w-full flex-col items-center justify-center gap-0.5 select-none active:opacity-60 transition-opacity"
                >
                  {content}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
`;

await writeFileSafe("src/components/shell/mobile-bottom-nav.tsx", BOTTOM_NAV);

// ===========================================================================
// 3. src/components/shell/mobile-topbar.tsx
// ===========================================================================

const MOBILE_TOPBAR = `"use client";

import { Menu, Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { NotificationBell } from "./notification-bell";
import type { Reminder } from "@/lib/calendar/reminders";

export function MobileTopbar({
  reminders,
  onMenu,
}: {
  reminders: Reminder[];
  onMenu: () => void;
}) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const toggleTheme = () => {
    const next =
      theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
    setTheme(next);
  };
  const ThemeIcon = !mounted
    ? Sun
    : theme === "light"
    ? Sun
    : theme === "dark"
    ? Moon
    : Monitor;

  return (
    <div
      className="glass fixed inset-x-0 top-0 z-[80] flex h-14 items-center gap-2 border-x-0 border-t-0 px-3 lg:hidden"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <button
        onClick={onMenu}
        aria-label="Open menu"
        className="flex h-10 w-10 items-center justify-center rounded-xl text-ink-700 transition-colors hover:bg-white/60 active:opacity-60 dark:text-ink-200 dark:hover:bg-white/[0.06]"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex flex-1 items-center gap-2 min-w-0">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-gradient shadow-glow-sm">
          <span className="text-xs font-bold text-white">A</span>
        </div>
        <span className="truncate text-sm font-semibold tracking-tight text-ink-900 dark:text-ink-100">
          Apartment Portal
        </span>
      </div>

      <NotificationBell reminders={reminders} />

      <button
        onClick={toggleTheme}
        aria-label="Toggle theme"
        className="flex h-10 w-10 items-center justify-center rounded-xl text-ink-500 transition-colors hover:bg-white/60 active:opacity-60 dark:hover:bg-white/[0.06]"
      >
        <ThemeIcon className="h-[18px] w-[18px]" />
      </button>
    </div>
  );
}
`;

await writeFileSafe("src/components/shell/mobile-topbar.tsx", MOBILE_TOPBAR);

// ===========================================================================
// 4. src/components/shell/dashboard-shell.tsx — REWRITE
// ===========================================================================

const SHELL = `"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { MobileDrawer } from "./mobile-drawer";
import { MobileTopbar } from "./mobile-topbar";
import { MobileBottomNav } from "./mobile-bottom-nav";
import type { UserRole } from "@/lib/auth/get-user-roles";
import type { Reminder } from "@/lib/calendar/reminders";

export function DashboardShell({
  sidebar,
  topbar,
  roles,
  reminders,
  children,
}: {
  sidebar: React.ReactNode;
  topbar: React.ReactNode;
  roles: UserRole[];
  reminders: Reminder[];
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  return (
    <div className="app-shell-v2" style={{ gridTemplateColumns: "16rem 1fr" }}>
      <aside className="app-sidebar-v2">{sidebar}</aside>
      <header className="app-header-v2">{topbar}</header>
      <main className="app-main-v2">
        <div className="mx-auto max-w-[1500px] p-4 pb-24 pt-20 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>

      {/* Mobile-only chrome */}
      <MobileTopbar reminders={reminders} onMenu={() => setDrawerOpen(true)} />
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        {sidebar}
      </MobileDrawer>
      <MobileBottomNav roles={roles} onMore={() => setDrawerOpen(true)} />
    </div>
  );
}
`;

await writeFileSafe("src/components/shell/dashboard-shell.tsx", SHELL);

// ===========================================================================
// 5. Patch the dashboard layout to pass roles + reminders
// ===========================================================================

await patchFile("src/app/(dashboard)/layout.tsx", (src) => {
  let out = src;
  out = out.replace(
    /<DashboardShell\s+sidebar=\{<Sidebar roles=\{roles\} email=\{user\.email \?\? ""\} \/>\}\s+topbar=\{<Topbar roles=\{roles\} reminders=\{reminders\} \/>\}/,
    '<DashboardShell\n      sidebar={<Sidebar roles={roles} email={user.email ?? ""} />}\n      topbar={<Topbar roles={roles} reminders={reminders} />}\n      roles={roles}\n      reminders={reminders}'
  );
  return out;
});

// ===========================================================================
// 6. Patch globals.css for the mobile shell
// ===========================================================================

await patchFile("src/app/globals.css", (src) => {
  let out = src;

  // Replace the old empty mobile breakpoint with a proper one.
  out = out.replace(
    /@media \(max-width: 900px\) \{[\s\S]*?\n\}/,
    `@media (max-width: 900px) {
  .app-shell-v2 {
    grid-template-columns: 1fr !important;
    grid-template-areas:
      "header"
      "main";
    height: 100dvh;
  }
  .app-sidebar-v2 { display: none; }
  .app-header-v2 { display: none; }
  .app-main-v2 {
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
    -webkit-overflow-scrolling: touch;
    overscroll-behavior-y: contain;
  }
}`
  );

  // Append native-feel rules if not already present.
  if (!out.includes("/* Native mobile polish */")) {
    out += `

/* Native mobile polish */
html, body {
  overscroll-behavior-y: none;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

body {
  padding-top: env(safe-area-inset-top);
}

/* Prevent text selection on nav buttons */
nav a, nav button {
  -webkit-user-select: none;
  user-select: none;
}

/* Bottom nav safe-area on installed PWA */
@supports (padding: env(safe-area-inset-bottom)) {
  body { padding-bottom: 0; }
}
`;
  }

  return out;
});

// ===========================================================================
// 7. Patch root layout — viewport, theme-color, apple meta
// ===========================================================================

await patchFile("src/app/layout.tsx", (src) => {
  let out = src;

  if (!out.includes('name="theme-color"')) {
    // Add viewport export (Next 15) and extra meta tags.
    out = out.replace(
      /export const metadata: Metadata = \{[\s\S]*?\};/,
      (block) =>
        block +
        `

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover" as const,
  themeColor: "#3b6fff",
};`
    );
  }

  // Apple meta tags in the head
  out = out.replace(
    /<head>\s*<\/head>/,
    ""
  );
  out = out.replace(
    /<html lang="en-PH" suppressHydrationWarning>/,
    `<html lang="en-PH" suppressHydrationWarning>`
  );
  if (!out.includes('apple-mobile-web-app-capable')) {
    out = out.replace(
      /<body>/,
      `<head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Apartment Portal" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="format-detection" content="telephone=no" />
      </head>
      <body>`
    );
  }

  return out;
});

console.log("");
console.log("Done. Next:");
console.log("  1. npm run typecheck");
console.log("  2. npm run dev");
console.log("  3. In Chrome DevTools, toggle device toolbar (Ctrl+Shift+M)");
console.log("     Pick iPhone 14 or Pixel 7 — the mobile shell appears");
console.log("");
console.log("Optional: add to home screen on a real phone to test standalone mode.");
console.log("");