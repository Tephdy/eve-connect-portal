"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { createJobOrderAction, updateJobOrderAction } from "@/app/(dashboard)/maintenance/actions";
import type { ActionResult } from "@/lib/actions/result";
import type { JobOrder } from "@/lib/db/job-orders";
import type { Unit } from "@/lib/db/units";
import type { JobTaskType } from "@/lib/db/job-task-types";

const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const STATUSES = [
  { value: "open", label: "Open" },
  { value: "pending_approval", label: "Pending approval" },
  { value: "assigned", label: "Assigned" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
  { value: "cancelled", label: "Cancelled" },
];

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" loading={pending}>{label}</Button>;
}

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + day;
}

export function JobOrderForm({
  mode,
  job,
  units,
  taskTypes,
}: {
  mode: "create" | "edit";
  job?: JobOrder;
  units: Unit[];
  taskTypes: JobTaskType[];
}) {
  const router = useRouter();
  const toast = useToast();
  const action = mode === "create" ? createJobOrderAction : updateJobOrderAction.bind(null, job!.id);
  const [state, formAction] = useActionState<ActionResult | null, FormData>(action, null);

  useEffect(() => {
    if (state?.ok) {
      toast.push(mode === "create" ? "Job order created" : "Job order updated", "success");
      if (mode === "edit") router.refresh();
    } else if (state && !state.ok) {
      toast.push(state.error, "error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const fieldError = (k: string) => (state && !state.ok ? state.fieldErrors?.[k] : undefined);

  const unitOptions = units.map((u) => ({
    value: u.id,
    label: u.unit_number + (u.property_name ? " — " + u.property_name : ""),
  }));
  const typeOptions = taskTypes.map((t) => ({ value: t.id, label: t.name }));

  // Default scheduled date: today (for new jobs) or existing value (for edits)
  const scheduledDefault = job?.scheduled_date ?? (mode === "create" ? todayIso() : "");

  return (
    <Card>
      <CardBody>
        <form action={formAction} className="space-y-4">
          <Select
            name="unit_id" label="Unit" options={unitOptions} placeholder="Select a unit"
            defaultValue={job?.unit_id ?? ""} error={fieldError("unit_id")} required
          />
          <Select
            name="task_type_id" label="Task type" options={typeOptions} placeholder="Select a task type"
            defaultValue={job?.task_type_id ?? ""} error={fieldError("task_type_id")} required
          />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Select
              name="priority" label="Priority" options={PRIORITIES}
              defaultValue={job?.priority ?? "normal"} error={fieldError("priority")}
            />
            <div className="space-y-1.5">
              <label
                htmlFor="scheduled_date"
                className="flex items-center gap-1.5 text-sm font-medium text-ink-700"
              >
                <Calendar className="h-3.5 w-3.5 text-ink-400" />
                Scheduled date
              </label>
              <input
                id="scheduled_date"
                name="scheduled_date"
                type="date"
                defaultValue={scheduledDefault}
                className="h-9 w-full rounded-md border border-ink-200 bg-surface px-3 text-sm text-ink-900 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-white/[0.06]"
              />
              <p className="text-xs text-ink-500">
                When the work is planned to be done.
              </p>
            </div>
          </div>

          <Textarea
            name="description" label="Description" rows={4}
            defaultValue={job?.description ?? ""} error={fieldError("description")}
            required
          />
          <Input
            name="cost_estimate" label="Cost estimate (PHP)" type="number" step="0.01" min={0}
            defaultValue={job?.cost_estimate ?? 0} error={fieldError("cost_estimate")}
            hint="If this exceeds the task-type threshold, accounting approval is required."
          />
          {mode === "edit" && (
            <Select
              name="status" label="Status" options={STATUSES}
              defaultValue={job?.status ?? "open"} error={fieldError("status")}
            />
          )}
          <div className="flex items-center gap-3 pt-2">
            <SubmitButton label={mode === "create" ? "Create Job Order" : "Save Changes"} />
            <Button type="button" variant="secondary" onClick={() => router.push("/maintenance")}>
              Cancel
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
