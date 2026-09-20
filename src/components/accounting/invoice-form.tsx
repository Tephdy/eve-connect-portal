"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { createInvoiceAction } from "@/app/(dashboard)/accounting/invoices/actions";
import type { ActionResult } from "@/lib/actions/result";
import type { Lease } from "@/lib/db/leases";

const TYPES = [
  { value: "rent",    label: "Rent" },
  { value: "deposit", label: "Deposit" },
  { value: "penalty", label: "Penalty" },
  { value: "other",   label: "Other" },
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" loading={pending}>Create Invoice</Button>;
}

export function InvoiceForm({ leases }: { leases: Lease[] }) {
  const router = useRouter();
  const toast = useToast();
  const [state, formAction] = useActionState<ActionResult | null, FormData>(createInvoiceAction, null);

  useEffect(() => {
    if (state?.ok) toast.push("Invoice created", "success");
    else if (state && !state.ok) toast.push(state.error, "error");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const fieldError = (k: string) => (state && !state.ok ? state.fieldErrors?.[k] : undefined);

  const leaseOptions = leases.map((l) => ({
    value: l.id,
    label: (l.unit_number ?? "Unit ?") + " — " + (l.tenant_name ?? "Tenant ?"),
  }));

  return (
    <Card className="max-w-2xl">
      <CardBody>
        <form action={formAction} className="space-y-4">
          <Select
            name="lease_id" label="Lease" options={leaseOptions} placeholder="Select a lease"
            error={fieldError("lease_id")} required
          />
          <Select
            name="type" label="Type" options={TYPES} defaultValue="rent" error={fieldError("type")}
          />
          <Input
            name="amount" label="Amount (PHP)" type="number" step="0.01" min={0.01}
            error={fieldError("amount")} required
          />
          <Input
            name="due_date" label="Due date" type="date"
            error={fieldError("due_date")} required
          />
          <div className="flex items-center gap-3 pt-2">
            <SubmitButton />
            <Button type="button" variant="secondary" onClick={() => router.push("/accounting/invoices")}>
              Cancel
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
