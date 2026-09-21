"use client";

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
