"use client";

import { Search } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function SearchBar({ className }: { className?: string }) {
  return (
    <button
      type="button"
      className={cn(
        "group flex h-10 w-full max-w-md items-center gap-3 rounded-lg border border-ink-200 bg-surface-muted px-3.5 text-left text-sm text-ink-500 transition-colors",
        "hover:border-ink-300 hover:bg-surface dark:border-white/[0.06] dark:bg-white/[0.03] dark:hover:border-white/[0.10] dark:hover:bg-white/[0.05]",
        className
      )}
    >
      <Search className="h-4 w-4 shrink-0 text-ink-400" />
      <span className="flex-1 truncate">Search…</span>
      <span className="hidden items-center gap-1 rounded border border-ink-200 bg-surface px-1.5 py-0.5 font-mono text-[10px] font-medium text-ink-400 sm:inline-flex dark:border-white/[0.08] dark:bg-white/[0.04]">
        <span>⌘</span>
        <span>K</span>
      </span>
    </button>
  );
}
