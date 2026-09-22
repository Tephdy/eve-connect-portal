"use client";

import { Search } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function SearchBar({ className }: { className?: string }) {
  return (
    <button
      type="button"
      className={cn(
        "group flex h-10 w-full max-w-md items-center gap-3 rounded-xl border border-white/60 bg-white/50 px-3.5 text-left text-sm text-ink-500 backdrop-blur-sm transition-all",
        "hover:border-white/80 hover:bg-white/70 dark:border-white/[0.08] dark:bg-white/[0.04] dark:hover:bg-white/[0.08]",
        className
      )}
    >
      <Search className="h-4 w-4 shrink-0 text-ink-400" />
      <span className="flex-1 truncate">Search…</span>
      <span className="hidden items-center gap-1 rounded-md border border-white/60 bg-white/60 px-1.5 py-0.5 font-mono text-[10px] font-medium text-ink-400 sm:inline-flex dark:border-white/[0.08] dark:bg-white/[0.06]">
        <span>⌘</span>
        <span>K</span>
      </span>
    </button>
  );
}
