"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { updateInvoiceAction } from "@/app/(dashboard)/accounting/invoices/actions";
import type { ActionResult } from "@/lib/actions/result";
import type { Invoice } from "@/lib/db/invoices";

const TYPES = [
  { value: "rent",            label: "Rent" },
  { value: "utility",         label: "Utility" },
  { value: "deposit",         label: "Deposit" },
  { value: "penalty",         label: "Penalty" },
  { value: "add-ons",         label: "Add-ons" },
  { value: "reservation_fee", label: "Reservation fee" },
  { value: "other",           label: "Other" },
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" loading={pending}>Save Changes</Button>;
}

export function InvoiceEditForm({ invoice }: { invoice: Invoice }) {
  const router = useRouter();
  const toast = useToast();
  const boundAction = updateInvoiceAction.bind(null, invoice.id);
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    boundAction,
    null
  );

  useEffect(() => {
    if (state?.ok) {
      toast.push("Invoice updated", "success");
      router.push("/accounting/invoices/" + invoice.id);
    } else if (state && !state.ok) {
      toast.push(state.error, "error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const fieldError = (k: string) =>
    state && !state.ok ? state.fieldErrors?.[k] : undefined;

  return (
    <Card className="max-w-2xl">
      <CardBody>
        <form action={formAction} className="space-y-4">
          <div className="rounded-md border border-ink-200 bg-surface-50 p-3 text-xs text-ink-600 dark:border-white/[0.06]">
            Editing <strong>{invoice.display_number ?? invoice.id.slice(0, 8)}</strong>
            {invoice.tenant_name ? " for " + invoice.tenant_name : ""}
            {invoice.unit_number ? " (Unit " + invoice.unit_number + ")" : ""}
          </div>

          <Select
            name="type"
            label="Type"
            options={TYPES}
            defaultValue={invoice.type}
            error={fieldError("type")}
          />

          <Input
            name="amount"
            label="Amount (PHP)"
            type="number"
            step="0.01"
            min={0.01}
            defaultValue={String(invoice.amount)}
            error={fieldError("amount")}
            required
          />

          <Input
            name="due_date"
            label="Due date"
            type="date"
            defaultValue={invoice.due_date}
            error={fieldError("due_date")}
            required
          />

          <div className="flex items-center gap-3 pt-2">
            <SubmitButton />
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push("/accounting/invoices/" + invoice.id)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}