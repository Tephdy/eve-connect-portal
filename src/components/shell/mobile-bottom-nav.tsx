"use client";

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
