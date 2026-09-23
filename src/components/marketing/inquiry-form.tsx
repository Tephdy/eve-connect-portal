"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { createInquiryAction, updateInquiryAction } from "@/app/(dashboard)/marketing/inquiries/actions";
import type { ActionResult } from "@/lib/actions/result";
import type { Inquiry } from "@/lib/db/inquiries";
import type { Unit } from "@/lib/db/units";

const STATUSES = [
  { value: "open",      label: "Open" },
  { value: "contacted", label: "Contacted" },
  { value: "converted", label: "Converted" },
  { value: "lost",      label: "Lost" },
];

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" loading={pending}>{label}</Button>;
}

export function InquiryForm({
  mode, inquiry, units,
}: { mode: "create" | "edit"; inquiry?: Inquiry; units: Unit[] }) {
  const router = useRouter();
  const toast = useToast();
  const action = mode === "create" ? createInquiryAction : updateInquiryAction.bind(null, inquiry!.id);
  const [state, formAction] = useActionState<ActionResult | null, FormData>(action, null);

  useEffect(() => {
    if (state?.ok) {
      toast.push(mode === "create" ? "Inquiry created" : "Inquiry updated", "success");
    } else if (state && !state.ok) toast.push(state.error, "error");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const fieldError = (k: string) => (state && !state.ok ? state.fieldErrors?.[k] : undefined);

  const unitOptions = units.map((u) => ({
    value: u.id,
    label: u.unit_number + (u.property_name ? " — " + u.property_name : ""),
  }));

  return (
    <Card className="max-w-2xl">
      <CardBody>
        <form action={formAction} className="space-y-4">
          <Input name="prospect_name" label="Prospect name"
            defaultValue={inquiry?.prospect_name ?? ""} error={fieldError("prospect_name")} required />

          <Input name="contact" label="Phone"
            defaultValue={inquiry?.contact ?? ""} error={fieldError("contact")}
            placeholder="e.g., 09171234567" />

          <Input name="email" label="Email" type="email"
            defaultValue={inquiry?.email ?? ""} error={fieldError("email")}
            placeholder="name@example.com" />

          <Input name="messenger_name" label="Messenger name"
            hint="Facebook / Messenger account name"
            defaultValue={inquiry?.messenger_name ?? ""} error={fieldError("messenger_name")} />

          <Input name="government_id" label="Government ID"
            hint="Client will send this to our official Facebook page."
            defaultValue={inquiry?.government_id ?? ""} error={fieldError("government_id")} />

          <Select name="unit_id" label="Interested unit (optional)"
            options={unitOptions} placeholder="Any unit"
            defaultValue={inquiry?.unit_id ?? ""} error={fieldError("unit_id")} />

          <Input name="source" label="Source" hint="e.g. Facebook, referral, walk-in"
            defaultValue={inquiry?.source ?? ""} error={fieldError("source")} />

          <Select name="status" label="Status" options={STATUSES}
            defaultValue={inquiry?.status ?? "open"} error={fieldError("status")} />

          <div className="flex items-center gap-3 pt-2">
            <SubmitButton label={mode === "create" ? "Create Inquiry" : "Save Changes"} />
            <Button type="button" variant="secondary" onClick={() => router.push("/marketing/inquiries")}>
              Cancel
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}