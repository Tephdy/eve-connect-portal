"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { createListingAction, updateListingAction } from "@/app/(dashboard)/marketing/listings/actions";
import type { ActionResult } from "@/lib/actions/result";
import type { Listing } from "@/lib/db/listings";
import type { Unit } from "@/lib/db/units";

const STATUSES = [
  { value: "draft",     label: "Draft" },
  { value: "published", label: "Published" },
  { value: "unlisted",  label: "Unlisted" },
];

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" loading={pending}>{label}</Button>;
}

export function ListingForm({
  mode, listing, units,
}: { mode: "create" | "edit"; listing?: Listing; units: Unit[] }) {
  const router = useRouter();
  const toast = useToast();
  const action = mode === "create" ? createListingAction : updateListingAction.bind(null, listing!.id);
  const [state, formAction] = useActionState<ActionResult | null, FormData>(action, null);

  useEffect(() => {
    if (state?.ok) {
      toast.push(mode === "create" ? "Listing created" : "Listing updated", "success");
      if (mode === "edit") router.refresh();
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
          <Select
            name="unit_id" label="Unit" options={unitOptions} placeholder="Select a unit"
            defaultValue={listing?.unit_id ?? ""} error={fieldError("unit_id")} required
          />
          <Input
            name="title" label="Title" defaultValue={listing?.title ?? ""}
            error={fieldError("title")} required
          />
          <Textarea
            name="description" label="Description" rows={5}
            defaultValue={listing?.description ?? ""} error={fieldError("description")}
          />
          <Input
            name="asking_rent" label="Asking rent (PHP)" type="number" step="0.01" min={0}
            defaultValue={listing?.asking_rent ?? ""} error={fieldError("asking_rent")}
          />
          <Select name="status" label="Status" options={STATUSES}
            defaultValue={listing?.status ?? "draft"} error={fieldError("status")} />
          <div className="flex items-center gap-3 pt-2">
            <SubmitButton label={mode === "create" ? "Create Listing" : "Save Changes"} />
            <Button type="button" variant="secondary" onClick={() => router.push("/marketing/listings")}>
              Cancel
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
