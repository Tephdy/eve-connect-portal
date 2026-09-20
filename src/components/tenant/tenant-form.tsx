"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { createTenantAction, updateTenantAction } from "@/app/(dashboard)/property/tenants/actions";
import type { ActionResult } from "@/lib/actions/result";
import type { Tenant } from "@/lib/db/tenants";

const STATUS_OPTIONS = [
  { value: "prospect",    label: "Prospect" },
  { value: "active",      label: "Active" },
  { value: "former",      label: "Former" },
  { value: "blacklisted", label: "Blacklisted" },
];

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" loading={pending}>{label}</Button>;
}

export function TenantForm({
  mode,
  tenant,
}: {
  mode: "create" | "edit";
  tenant?: Tenant;
}) {
  const router = useRouter();
  const toast = useToast();
  const action = mode === "create" ? createTenantAction : updateTenantAction.bind(null, tenant!.id);
  const [state, formAction] = useActionState<ActionResult | null, FormData>(action, null);

  useEffect(() => {
    if (state?.ok) {
      toast.push(mode === "create" ? "Tenant created" : "Tenant updated", "success");
      if (mode === "edit") router.refresh();
    } else if (state && !state.ok) {
      toast.push(state.error, "error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const fieldError = (k: string) => (state && !state.ok ? state.fieldErrors?.[k] : undefined);

  return (
    <Card className="max-w-2xl">
      <CardBody>
        <form action={formAction} className="space-y-4">
          <Input name="full_name" label="Full name" defaultValue={tenant?.full_name ?? ""} error={fieldError("full_name")} required />
          <Input name="email" label="Email" type="email" defaultValue={tenant?.email ?? ""} error={fieldError("email")} />
          <Input name="phone" label="Phone" defaultValue={tenant?.phone ?? ""} error={fieldError("phone")} />
          <Input name="messenger_name" label="Messenger name" hint="e.g. Facebook / Messenger account name" defaultValue={tenant?.messenger_name ?? ""} error={fieldError("messenger_name")}
              />
          <Input name="government_id" label="Government ID" defaultValue={tenant?.government_id ?? ""} error={fieldError("government_id")} hint="Stored securely; used for contracts." />
          <Select name="status" label="Status" options={STATUS_OPTIONS} defaultValue={tenant?.status ?? "prospect"} error={fieldError("status")} />
          <div className="flex items-center gap-3 pt-2">
            <SubmitButton label={mode === "create" ? "Create Tenant" : "Save Changes"} />
            <Button type="button" variant="secondary" onClick={() => router.push("/property/tenants")}>
              Cancel
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
