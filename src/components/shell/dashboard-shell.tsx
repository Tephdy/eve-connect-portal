"use client";

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
