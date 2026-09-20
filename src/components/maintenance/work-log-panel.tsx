"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { createWorkLogAction } from "@/app/(dashboard)/maintenance/actions";
import type { ActionResult } from "@/lib/actions/result";
import type { WorkLog } from "@/lib/db/work-logs";

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" loading={pending} size="sm">Add log</Button>;
}

export function WorkLogPanel({ jobOrderId, logs }: { jobOrderId: string; logs: WorkLog[] }) {
  const toast = useToast();
  const [state, formAction] = useActionState<ActionResult | null, FormData>(createWorkLogAction, null);

  useEffect(() => {
    if (state?.ok) toast.push("Work log added", "success");
    else if (state && !state.ok) toast.push(state.error, "error");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const fieldError = (k: string) => (state && !state.ok ? state.fieldErrors?.[k] : undefined);

  return (
    <Card>
      <CardHeader title="Work Logs" description={logs.length + " entries"} />
      <CardBody className="space-y-4">
        <form action={formAction} className="space-y-3 border-b border-gray-100 pb-4">
          <input type="hidden" name="job_order_id" value={jobOrderId} />
          <Textarea name="notes" label="Notes" rows={2} error={fieldError("notes")} required />
          <div className="grid grid-cols-2 gap-3">
            <Input name="hours" label="Hours" type="number" step="0.25" min={0} error={fieldError("hours")} />
            <Input name="parts_used" label="Parts used (summary)" error={fieldError("parts_used")} />
          </div>
          <SubmitButton />
        </form>

        {logs.length === 0 ? (
          <p className="text-sm text-gray-500">No work logs yet.</p>
        ) : (
          <ul className="space-y-3">
            {logs.map((l) => (
              <li key={l.id} className="text-sm">
                <p className="text-gray-800">{l.notes}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {l.hours ? l.hours + "h · " : ""}
                  {l.completed_at ? new Date(l.completed_at).toLocaleString("en-PH") : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
