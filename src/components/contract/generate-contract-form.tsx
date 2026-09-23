"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { generateContractAction } from "@/app/(dashboard)/property/contracts/actions";
import type { ActionResult } from "@/lib/actions/result";
import type { Lease } from "@/lib/db/leases";
import type { ContractTemplate } from "@/lib/db/templates";
import type { Unit } from "@/lib/db/units";

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" loading={pending}>Generate Contract</Button>;
}

export function GenerateContractForm({
  leases,
  templates,
  units,
}: {
  leases: Lease[];
  templates: ContractTemplate[];
  units: Unit[];
}) {
  const router = useRouter();
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    generateContractAction,
    null
  );

  const [leaseId, setLeaseId] = useState<string>("");
  const [templateId, setTemplateId] = useState<string>("");

  function applyLease(id: string) {
    setLeaseId(id);
    const lease = leases.find((l) => l.id === id);
    if (!lease) return;

    // Derive the lease's property through its unit
    const unit = units.find((u) => u.id === lease.unit_id);
    const propId = unit?.property_id ?? null;

    // Priority:
    // 1. template for this exact property
    // 2. universal template (property_id is null)
    // 3. first template (last resort)
    const byProperty = templates.find(
      (t: any) => t.property_id && t.property_id === propId
    );
    const universal = templates.find((t: any) => !t.property_id);
    const matched = byProperty ?? universal ?? templates[0];

    if (matched) setTemplateId(matched.id);
  }

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
            value={leaseId}
            onChange={(e) => applyLease(e.target.value)}
            error={state && !state.ok ? state.fieldErrors?.lease_id : undefined}
            required
          />
          <Select
            name="template_id"
            label="Template"
            options={tplOptions}
            placeholder="Select a template"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            error={state && !state.ok ? state.fieldErrors?.template_id : undefined}
            hint="Auto-selected based on the lease's property. Change if needed."
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
