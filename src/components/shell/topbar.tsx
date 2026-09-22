"use client";

import { useEffect, useState } from "react";
import { Moon, Sun, Monitor, Plus } from "lucide-react";
import { useTheme } from "next-themes";
import { SearchBar } from "./search-bar";
import { RolePill } from "./role-badge";
import { NotificationBell } from "./notification-bell";
import type { UserRole } from "@/lib/auth/get-user-roles";
import type { Reminder } from "@/lib/calendar/reminders";

export function Topbar({
  roles,
  reminders,
}: {
  roles: UserRole[];
  reminders: Reminder[];
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
    <div className="glass flex h-16 items-center gap-4 rounded-none border-x-0 border-t-0 px-6">
      <div className="flex flex-1 items-center gap-4">
        <SearchBar />
      </div>

      <div className="flex items-center gap-2">
        <RolePill roles={roles} />

        <div className="mx-1 h-6 w-px bg-ink-200/50 dark:bg-white/[0.08]" />

        <NotificationBell reminders={reminders} />

        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="rounded-xl p-2 text-ink-500 transition-colors hover:bg-white/60 hover:text-ink-900 dark:hover:bg-white/[0.06]"
        >
          <ThemeIcon className="h-[18px] w-[18px]" />
        </button>

        <div className="mx-1 h-6 w-px bg-ink-200/50 dark:bg-white/[0.08]" />

        <button className="hidden h-9 items-center gap-1.5 rounded-xl bg-brand-gradient px-3.5 text-sm font-semibold text-white shadow-md shadow-brand-500/30 transition-all hover:shadow-lg hover:shadow-brand-500/40 sm:inline-flex">
          <Plus className="h-4 w-4" />
          Quick action
        </button>
      </div>
    </div>
  );
}
