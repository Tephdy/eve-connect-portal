"use client";

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
