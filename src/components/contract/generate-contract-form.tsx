"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { generateContractAction } from "@/app/(dashboard)/property/contracts/actions";
import type { ActionResult } from "@/lib/actions/result";
import type { Lease } from "@/lib/db/leases";
import type { ContractTemplate } from "@/lib/db/templates";

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" loading={pending}>Generate Contract</Button>;
}

export function GenerateContractForm({
  leases,
  templates,
}: {
  leases: Lease[];
  templates: ContractTemplate[];
}) {
  const router = useRouter();
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    generateContractAction,
    null
  );

  const leaseOptions = leases.map((l) => ({
    value: l.id,
    label:
      (l.unit_number ?? "Unit ?") +
      " — " +
      (l.tenant_name ?? "Tenant ?") +
      " (" +
      l.start_date +
      " → " +
      l.end_date +
      ")",
  }));

  const tplOptions = templates.map((t) => ({ value: t.id, label: t.name }));

  return (
    <Card className="max-w-2xl">
      <CardBody>
        <form action={formAction} className="space-y-4">
          <Select
            name="lease_id"
            label="Lease"
            options={leaseOptions}
            placeholder="Select a lease"
            error={state && !state.ok ? state.fieldErrors?.lease_id : undefined}
            required
          />
          <Select
            name="template_id"
            label="Template"
            options={tplOptions}
            placeholder="Select a template"
            error={state && !state.ok ? state.fieldErrors?.template_id : undefined}
            required
          />
          {state && !state.ok && (
            <p className="text-xs text-red-600">{state.error}</p>
          )}
          <div className="flex items-center gap-3 pt-2">
            <SubmitButton />
            <Button type="button" variant="secondary" onClick={() => router.push("/property/contracts")}>
              Cancel
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
