"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { createLeaseAction, updateLeaseAction } from "@/app/(dashboard)/property/leases/actions";
import type { ActionResult } from "@/lib/actions/result";
import type { Lease } from "@/lib/db/leases";
import type { Unit } from "@/lib/db/units";
import type { Tenant } from "@/lib/db/tenants";

const STATUSES = [
  { value: "draft",      label: "Draft" },
  { value: "active",     label: "Active" },
  { value: "expiring",   label: "Expiring" },
  { value: "ended",      label: "Ended" },
  { value: "terminated", label: "Terminated" },
];

const INTENTS = [
  { value: "new",    label: "New" },
  { value: "renew",  label: "Renew" },
  { value: "extend", label: "Extend" },
];

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" loading={pending}>{label}</Button>;
}

function adOnsToText(raw: unknown): string {
  if (!Array.isArray(raw)) return "";
  return raw.map((x: any) => (typeof x === "string" ? x : x.text ?? "")).filter(Boolean).join(", ");
}

export function LeaseForm({
  mode, lease, units, tenants,
}: {
  mode: "create" | "edit";
  lease?: Lease;
  units: Unit[];
  tenants: Tenant[];
}) {
  const router = useRouter();
  const toast = useToast();
  const action = mode === "create" ? createLeaseAction : updateLeaseAction.bind(null, lease!.id);
  const [state, formAction] = useActionState<ActionResult | null, FormData>(action, null);

  useEffect(() => {
    if (state?.ok) {
      toast.push(mode === "create" ? "Lease created" : "Lease updated", "success");
    } else if (state && !state.ok) toast.push(state.error, "error");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const fieldError = (k: string) => (state && !state.ok ? state.fieldErrors?.[k] : undefined);

  const unitOptions = units.map((u) => ({
    value: u.id,
    label: u.unit_number + (u.property_name ? " — " + u.property_name : ""),
  }));
  const tenantOptions = tenants.map((t) => ({ value: t.id, label: t.full_name }));

  return (
    <Card className="max-w-3xl">
      <CardBody>
        <form action={formAction} className="space-y-5">

          <div className="grid grid-cols-2 gap-4">
            <Select
              name="unit_id" label="Unit" options={unitOptions} placeholder="Select a unit"
              defaultValue={lease?.unit_id ?? ""} error={fieldError("unit_id")} required
            />
            <Select
              name="tenant_id" label="Tenant" options={tenantOptions} placeholder="Select a tenant"
              defaultValue={lease?.tenant_id ?? ""} error={fieldError("tenant_id")} required
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Select name="intent" label="Intent" options={INTENTS}
              defaultValue={lease?.intent ?? "new"} error={fieldError("intent")} />
            <Input name="start_date" label="Start date" type="date"
              defaultValue={lease?.start_date ?? ""} error={fieldError("start_date")} required />
            <Input name="end_date" label="End of contract" type="date"
              defaultValue={lease?.end_date ?? ""} error={fieldError("end_date")} required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input name="move_in_date" label="Move-in date" type="date"
              defaultValue={lease?.move_in_date ?? ""} error={fieldError("move_in_date")} />
            <Input name="due_date" label="Rent due date" type="date"
              defaultValue={lease?.due_date ?? ""} error={fieldError("due_date")}
              hint="Date rent is due each month" />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Input name="monthly_rent" label="Monthly rent (PHP)" type="number" step="0.01" min={0}
              defaultValue={lease?.monthly_rent ?? ""} error={fieldError("monthly_rent")} required />
            <Input name="deposit_1" label="1st Deposit (PHP)" type="number" step="0.01" min={0}
              defaultValue={lease?.deposit_1 ?? 0} error={fieldError("deposit_1")} />
            <Input name="deposit_2" label="2nd Deposit (PHP)" type="number" step="0.01" min={0}
              defaultValue={lease?.deposit_2 ?? 0} error={fieldError("deposit_2")} />
          </div>

          <div>
            <Input
              name="ad_ons"
              label="Add-ons"
              hint="Comma-separated: Foam, AC, Bedframe, Others"
              defaultValue={adOnsToText(lease?.ad_ons)}
              error={fieldError("ad_ons")}
            />
            <div className="mt-3">
              <Input
                name="ad_ons_amount"
                label="Add-ons amount (PHP)"
                type="number"
                step="0.01"
                min={0}
                defaultValue={lease?.ad_ons_amount ?? 0}
                error={fieldError("ad_ons_amount")}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input name="notice_period_days" label="Notice period (days)" type="number" min={0}
              defaultValue={lease?.notice_period_days ?? 30} error={fieldError("notice_period_days")} />
            <Select name="status" label="Status" options={STATUSES}
              defaultValue={lease?.status ?? "draft"} error={fieldError("status")} />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <SubmitButton label={mode === "create" ? "Create Lease" : "Save Changes"} />
            <Button type="button" variant="secondary" onClick={() => router.push("/property/leases")}>
              Cancel
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}