#!/usr/bin/env node
/**
 * UI Pass 1 — Foundations (Steps 5-10)
 * Usage: node scaffold-ui-pass1.mjs
 *
 * Creates/overwrites:
 *   src/components/theme/theme-provider.tsx
 *   src/components/theme/theme-toggle.tsx
 *   src/app/layout.tsx
 *   src/app/(dashboard)/layout.tsx
 *   src/components/shell/topbar.tsx
 *   src/components/shell/sidebar.tsx
 */

import { mkdir, writeFile, access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { join, dirname } from "node:path";

const ROOT = process.cwd();
const FILES = {};

async function exists(p) {
  try { await access(p, constants.F_OK); return true; } catch { return false; }
}

// -----------------------------------------------------------------------------
// 5. Theme provider
// -----------------------------------------------------------------------------
FILES["src/components/theme/theme-provider.tsx"] =
`"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
`;

// -----------------------------------------------------------------------------
// 6. Theme toggle
// -----------------------------------------------------------------------------
FILES["src/components/theme/theme-toggle.tsx"] =
`"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-9 w-9" />;

  const next =
    theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setTheme(next)}
      aria-label="Toggle theme"
      className="h-9 w-9 p-0"
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}
`;

// -----------------------------------------------------------------------------
// 7. Root layout
// -----------------------------------------------------------------------------
FILES["src/app/layout.tsx"] =
`import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";
import { ThemeProvider } from "@/components/theme/theme-provider";

export const metadata: Metadata = {
  title: "Apartment Portal",
  description: "Internal operations portal for apartment rental management.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-PH" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
`;

// -----------------------------------------------------------------------------
// 8. Dashboard layout — fixed shell
// -----------------------------------------------------------------------------
FILES["src/app/(dashboard)/layout.tsx"] =
`import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/get-session";
import { getUserRoles } from "@/lib/auth/get-user-roles";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();
  if (!user) redirect("/login");

  const roles = await getUserRoles();

  return (
    <div className="app-shell">
      <aside className="app-sidebar border-r border-ink-200 bg-surface">
        <Sidebar roles={roles} />
      </aside>

      <header className="app-header border-b border-ink-200 bg-surface">
        <Topbar email={user.email ?? ""} roles={roles} />
      </header>

      <main className="app-main">
        <div className="mx-auto max-w-[1400px] p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
`;

// -----------------------------------------------------------------------------
// 9. Topbar
// -----------------------------------------------------------------------------
FILES["src/components/shell/topbar.tsx"] =
`import type { UserRole } from "@/lib/auth/get-user-roles";
import { RoleBadge } from "./role-badge";
import { SignOutButton } from "./sign-out-button";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export function Topbar({
  email,
  roles,
}: {
  email: string;
  roles: UserRole[];
}) {
  return (
    <div className="flex h-14 items-center justify-between px-6">
      <div className="flex items-center gap-2">
        {roles.map((r) => (
          <RoleBadge key={r.role_key} roleKey={r.role_key} />
        ))}
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden text-sm text-ink-600 sm:inline">{email}</span>
        <ThemeToggle />
        <SignOutButton />
      </div>
    </div>
  );
}
`;

// -----------------------------------------------------------------------------
// 10. Sidebar
// -----------------------------------------------------------------------------
FILES["src/components/shell/sidebar.tsx"] =
`"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { UserRole } from "@/lib/auth/get-user-roles";

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

export function Sidebar({ roles }: { roles: UserRole[] }) {
  const pathname = usePathname();
  const keys = roles.map((r) => r.role_key);

  const visibleGroups: NavGroup[] = GROUPS.map((g) => {
    if (!g.roles.includes("*") && !g.roles.some((r) => keys.includes(r))) return null;
    const items = g.items.filter(
      (item) => item.roles.includes("*") || item.roles.some((r) => keys.includes(r))
    );
    if (items.length === 0) return null;
    return { ...g, items };
  }).filter((g): g is NavGroup => g !== null);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center border-b border-ink-200 px-5">
        <span className="text-md font-semibold text-brand-600 dark:text-brand-400">
          Apartment Portal
        </span>
      </div>
      <nav className="flex-1 overflow-y-auto p-3 space-y-5">
        {visibleGroups.map((g) => (
          <div key={g.label}>
            <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
              {g.label}
            </p>
            <ul className="space-y-0.5">
              {g.items.map((item) => {
                const active = item.exact
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                        active
                          ? "bg-brand-50 text-brand-700 font-medium dark:bg-brand-900/30 dark:text-brand-300"
                          : "text-ink-700 hover:bg-ink-100 dark:hover:bg-ink-100"
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0",
                          active
                            ? "text-brand-600 dark:text-brand-400"
                            : "text-ink-400 group-hover:text-ink-600"
                        )}
                      />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
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

  const pkgText = await readFile(pkg, "utf8");
  if (!pkgText.includes('"apartment-portal"')) {
    console.warn("package.json name isn't 'apartment-portal'. Continue? (Enter to proceed)");
    await new Promise((r) => process.stdin.once("data", r));
  }

  // Sanity: dependencies installed?
  if (!pkgText.includes("lucide-react") || !pkgText.includes("next-themes")) {
    console.error("Missing dependencies. Run first:");
    console.error("  npm install lucide-react next-themes");
    process.exit(1);
  }

  console.log("UI Pass 1 — Foundations (Steps 5-10)\n");

  let count = 0;
  for (const [relPath, content] of Object.entries(FILES)) {
    const full = join(ROOT, relPath);
    const exists_ = await exists(full);
    console.log((exists_ ? "  ~ " : "  + ") + relPath);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, content, "utf8");
    count++;
  }

  console.log("\nDone - " + count + " file(s) written.\n");
  console.log("Next:");
  console.log("  1. Confirm tailwind.config.ts + src/app/globals.css match Pass 1 (from the previous message)");
  console.log("  2. npm run typecheck");
  console.log("  3. npm run dev");
  console.log("\nVerify:");
  console.log("  - Sidebar has icons, hover states, and active highlighting");
  console.log("  - Header is sticky (scroll a long list — header stays)");
  console.log("  - Only the content area scrolls, never the sidebar or header");
  console.log("  - Theme toggle in topbar cycles light → dark → system");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});