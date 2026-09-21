#!/usr/bin/env node
/**
 * Fix: DayPanel + JobDayPanel dismiss on ESC / outside click
 * Usage: node scaffold-day-panel-dismiss.mjs
 *
 * - Verifies src/lib/hooks/use-dismissable.ts exists
 *   (creates it if missing)
 * - Rewrites both day-panel components to use the hook + backdrop
 */

import { mkdir, writeFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import { join, dirname } from "node:path";

const ROOT = process.cwd();
const FILES = {};

async function exists(p) {
  try { await access(p, constants.F_OK); return true; } catch { return false; }
}

// =============================================================================
// 1. Hook — only written if missing
// =============================================================================
FILES["src/lib/hooks/use-dismissable.ts"] =
`"use client";

import { useEffect, useRef } from "react";

export function useDismissable({
  active,
  onDismiss,
  lockScroll = false,
}: {
  active: boolean;
  onDismiss: () => void;
  lockScroll?: boolean;
}): React.RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!active) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onDismiss();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active, onDismiss]);

  useEffect(() => {
    if (!active) return;

    function onPointerDown(e: PointerEvent | MouseEvent | TouchEvent) {
      const el = ref.current;
      if (!el) return;
      const target = e.target as Node | null;
      if (!target) return;
      if (!el.contains(target)) {
        onDismiss();
      }
    }

    const usePointer = typeof window !== "undefined" && "PointerEvent" in window;
    if (usePointer) {
      document.addEventListener("pointerdown", onPointerDown, true);
      return () => document.removeEventListener("pointerdown", onPointerDown, true);
    } else {
      document.addEventListener("mousedown", onPointerDown, true);
      document.addEventListener("touchstart", onPointerDown, true);
      return () => {
        document.removeEventListener("mousedown", onPointerDown, true);
        document.removeEventListener("touchstart", onPointerDown, true);
      };
    }
  }, [active, onDismiss]);

  useEffect(() => {
    if (!active || !lockScroll) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [active, lockScroll]);

  return ref;
}
`;

// =============================================================================
// 2. Payment calendar day panel
// =============================================================================
FILES["src/components/calendar/day-panel.tsx"] =
`"use client";

import { X, CalendarDays } from "lucide-react";
import { EventChip } from "./event-chip";
import { useDismissable } from "@/lib/hooks/use-dismissable";
import type { CalendarEvent } from "@/lib/calendar/types";

function formatDay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function DayPanel({
  date,
  events,
  onClose,
  onPreview,
}: {
  date: string | null;
  events: CalendarEvent[];
  onClose: () => void;
  onPreview: (e: CalendarEvent) => void;
}) {
  const ref = useDismissable({
    active: !!date,
    onDismiss: onClose,
  });

  if (!date) return null;

  return (
    <>
      {/* Invisible backdrop for click/touch outside */}
      <div
        className="fixed inset-0 z-30 bg-ink-900/20 md:bg-transparent"
        aria-hidden="true"
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-ink-200 bg-surface shadow-lg dark:border-white/[0.06]"
      >
        <div className="flex items-center justify-between border-b border-ink-200 px-5 py-4 dark:border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400">
              <CalendarDays className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink-900">
                {formatDay(date)}
              </p>
              <p className="text-xs text-ink-500">
                {events.length === 0
                  ? "No events"
                  : events.length + " event" + (events.length === 1 ? "" : "s")}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-white/[0.05]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <CalendarDays className="h-8 w-8 text-ink-300 dark:text-ink-400" />
              <p className="text-sm text-ink-500">Nothing scheduled</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {events.map((e) => (
                <li key={e.id}>
                  <EventChip event={e} variant="full" onPreview={onPreview} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
`;

// =============================================================================
// 3. Job calendar day panel
// =============================================================================
FILES["src/components/maintenance/calendar/job-day-panel.tsx"] =
`"use client";

import { X, CalendarDays } from "lucide-react";
import { JobEventChip } from "./job-event-chip";
import { useDismissable } from "@/lib/hooks/use-dismissable";
import type { JobCalendarEvent } from "@/lib/maintenance/calendar-types";

function formatDay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function JobDayPanel({
  date,
  events,
  onClose,
  onPreview,
}: {
  date: string | null;
  events: JobCalendarEvent[];
  onClose: () => void;
  onPreview: (e: JobCalendarEvent) => void;
}) {
  const ref = useDismissable({
    active: !!date,
    onDismiss: onClose,
  });

  if (!date) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-30 bg-ink-900/20 md:bg-transparent"
        aria-hidden="true"
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-ink-200 bg-surface shadow-lg dark:border-white/[0.06]"
      >
        <div className="flex items-center justify-between border-b border-ink-200 px-5 py-4 dark:border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400">
              <CalendarDays className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink-900">{formatDay(date)}</p>
              <p className="text-xs text-ink-500">
                {events.length === 0 ? "No jobs" : events.length + " job" + (events.length === 1 ? "" : "s")}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-white/[0.05]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <CalendarDays className="h-8 w-8 text-ink-300 dark:text-ink-400" />
              <p className="text-sm text-ink-500">No job orders</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {events.map((e) => (
                <li key={e.id}>
                  <JobEventChip event={e} variant="full" onPreview={onPreview} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
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

  console.log("Day Panel dismiss fix — ESC + outside click\\n");

  // Check if hook exists — only write it if missing
  const hookPath = join(ROOT, "src/lib/hooks/use-dismissable.ts");
  const hookExists = await exists(hookPath);

  if (hookExists) {
    console.log("  – src/lib/hooks/use-dismissable.ts  (already exists, skipping)");
    delete FILES["src/lib/hooks/use-dismissable.ts"];
  }

  let count = 0;
  for (const [relPath, content] of Object.entries(FILES)) {
    const full = join(ROOT, relPath);
    const exists_ = await exists(full);
    console.log((exists_ ? "  ~ " : "  + ") + relPath);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, content, "utf8");
    count++;
  }

  console.log("\\nDone — " + count + " file(s) written.\\n");
  console.log("Next:");
  console.log("  npm run typecheck");
  console.log("  npm run dev");
  console.log("\\nTest:");
  console.log("  - /maintenance/calendar → click a day → press ESC → panel closes");
  console.log("  - /maintenance/calendar → click a day → click outside → panel closes");
  console.log("  - Same for /accounting/calendar and /property/calendar");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});