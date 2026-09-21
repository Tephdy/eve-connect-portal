#!/usr/bin/env node
/**
 * Fix TypeScript errors:
 *  - useDismissable ref type
 *  - JobOrderActions missing props
 * Usage: node scaffold-ref-fix.mjs
 */

import { writeFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

async function exists(p) {
  try { await access(p, constants.F_OK); return true; } catch { return false; }
}

const FILES = {};

// ---------------------------------------------------------------------------
// 1. Hook — change RefObject<HTMLDivElement | null> → RefObject<HTMLDivElement>
// ---------------------------------------------------------------------------
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
}) {
  const ref = useRef<HTMLDivElement>(null);

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

    const usePointer =
      typeof window !== "undefined" && "PointerEvent" in window;
    if (usePointer) {
      document.addEventListener("pointerdown", onPointerDown, true);
      return () =>
        document.removeEventListener("pointerdown", onPointerDown, true);
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

// ---------------------------------------------------------------------------
// 2. JobOrderActions — accept canUpdate + canClose
// ---------------------------------------------------------------------------
FILES["src/components/maintenance/job-order-actions.tsx"] =
`"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  completeJobOrderAction,
  startJobOrderAction,
} from "@/app/(dashboard)/maintenance/actions";
import type { JobOrder } from "@/lib/db/job-orders";

export function JobOrderActions({
  job,
  canUpdate = true,
  canClose = true,
}: {
  job: JobOrder;
  canUpdate?: boolean;
  canClose?: boolean;
}) {
  const [pending, start] = useTransition();
  const toast = useToast();

  function onStart() {
    start(async () => {
      try {
        await startJobOrderAction(job.id);
        toast.push("Job started", "success");
      } catch {
        toast.push("Failed to start", "error");
      }
    });
  }

  function onComplete() {
    start(async () => {
      try {
        await completeJobOrderAction(job.id, job.unit_id);
        toast.push("Job completed", "success");
      } catch {
        toast.push("Failed to complete", "error");
      }
    });
  }

  const canStart =
    canUpdate && (job.status === "open" || job.status === "assigned");
  const canComplete =
    canClose && (job.status === "in_progress" || job.status === "assigned");

  if (!canStart && !canComplete) return null;

  return (
    <div className="rounded-lg border border-ink-200 bg-surface p-5 space-y-2 dark:border-white/[0.06]">
      <p className="text-sm font-medium text-ink-700">Actions</p>
      {canStart && (
        <Button onClick={onStart} loading={pending}>
          Start work
        </Button>
      )}
      {canComplete && (
        <Button variant="primary" onClick={onComplete} loading={pending}>
          Mark completed
        </Button>
      )}
    </div>
  );
}
`;

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------
async function main() {
  const pkg = join(ROOT, "package.json");
  if (!(await exists(pkg))) {
    console.error("package.json not found. Run from project root.");
    process.exit(1);
  }

  console.log("Fix ref typing + JobOrderActions props\\n");

  let count = 0;
  for (const [relPath, content] of Object.entries(FILES)) {
    const full = join(ROOT, relPath);
    const exists_ = await exists(full);
    console.log((exists_ ? "  ~ " : "  + ") + relPath);
    await writeFile(full, content, "utf8");
    count++;
  }

  console.log("\\nDone — " + count + " file(s) written.\\n");
  console.log("Next:");
  console.log("  npm run typecheck");
  console.log("  npm run dev");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});