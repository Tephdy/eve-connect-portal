"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { recordPaymentAction } from "@/app/(dashboard)/accounting/invoices/actions";
import type { ActionResult } from "@/lib/actions/result";
import { formatPHP } from "@/lib/utils/format-php";

const METHODS = [
  { value: "cash",          label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "gcash",         label: "GCash" },
  { value: "maya",          label: "Maya" },
  { value: "check",         label: "Check" },
  { value: "other",         label: "Other" },
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" loading={pending}>Record Payment</Button>;
}

export function PaymentForm({
  invoiceId,
  remaining,
}: {
  invoiceId: string;
  remaining: number;
}) {  const toast = useToast();
  const [state, formAction] = useActionState<ActionResult | null, FormData>(recordPaymentAction, null);

  useEffect(() => {
    if (state?.ok) {
      toast.push("Payment recorded", "success");
    } else if (state && !state.ok) {
      toast.push(state.error, "error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const fieldError = (k: string) => (state && !state.ok ? state.fieldErrors?.[k] : undefined);

  return (
    <Card>
      <CardHeader
        title="Record Payment"
        description={"Remaining: " + formatPHP(remaining)}
      />
      <CardBody>
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="invoice_id" value={invoiceId} />
          <Input
            name="amount" label="Amount" type="number" step="0.01" min={0.01}
            defaultValue={remaining}
            error={fieldError("amount")} required
          />
          <Select name="method" label="Method" options={METHODS} defaultValue="cash" />
          <Input name="reference_no" label="Reference #" hint="Optional" />
          <SubmitButton />
        </form>
      </CardBody>
    </Card>
  );
}
