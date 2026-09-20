"use client";

import { useEffect, useState } from "react";
import { Bell, Moon, Sun, Monitor, Plus } from "lucide-react";
import { useTheme } from "next-themes";
import { SearchBar } from "./search-bar";
import { RolePill } from "./role-badge";
import type { UserRole } from "@/lib/auth/get-user-roles";

export function Topbar({ roles }: { roles: UserRole[] }) {
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
    <div className="flex h-16 items-center gap-4 px-6">
      <div className="flex flex-1 items-center gap-4">
        <SearchBar />
      </div>

      <div className="flex items-center gap-2">
        <RolePill roles={roles} />

        <div className="mx-1 h-6 w-px bg-ink-200 dark:bg-white/[0.08]" />

        <button
          aria-label="Notifications"
          className="relative rounded-lg p-2 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900 dark:hover:bg-white/[0.05]"
        >
          <Bell className="h-[18px] w-[18px]" />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-danger-500" />
        </button>

        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="rounded-lg p-2 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900 dark:hover:bg-white/[0.05]"
        >
          <ThemeIcon className="h-[18px] w-[18px]" />
        </button>

        <div className="mx-1 h-6 w-px bg-ink-200 dark:bg-white/[0.08]" />

        <button className="hidden h-9 items-center gap-1.5 rounded-lg bg-brand-500 px-3.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 sm:inline-flex">
          <Plus className="h-4 w-4" />
          Quick action
        </button>
      </div>
    </div>
  );
}
