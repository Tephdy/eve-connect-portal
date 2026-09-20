"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import {
  createPropertyAction,
  updatePropertyAction,
} from "@/app/(dashboard)/property/properties/actions";
import type { ActionResult } from "@/lib/actions/result";
import type { Property } from "@/lib/db/properties";

const TYPE_OPTIONS = [
  { value: "studio_unit",     label: "Studio Unit" },
  { value: "one_two_bedroom", label: "1 & 2 Bedroom" },
  { value: "bedspace",        label: "Bedspace" },
];

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      {label}
    </Button>
  );
}

export function PropertyForm({
  mode,
  property,
}: {
  mode: "create" | "edit";
  property?: Property;
}) {
  const router = useRouter();
  const toast = useToast();

  const action =
    mode === "create"
      ? createPropertyAction
      : updatePropertyAction.bind(null, property!.id);

  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    action,
    null
  );

  useEffect(() => {
    if (state?.ok) {
      toast.push(mode === "create" ? "Property created" : "Property updated", "success");
      if (mode === "edit") router.refresh();
    } else if (state && !state.ok) {
      toast.push(state.error, "error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const fieldError = (key: string) =>
    state && !state.ok ? state.fieldErrors?.[key] : undefined;

  return (
    <Card className="max-w-2xl">
      <CardBody>
        <form action={formAction} className="space-y-4">
          <Input
            name="name"
            label="Property name"
            defaultValue={property?.name ?? ""}
            error={fieldError("name")}
            required
          />
          <Input
            name="address"
            label="Address"
            defaultValue={property?.address ?? ""}
            error={fieldError("address")}
          />
          <Select
            name="type"
            label="Type"
            options={TYPE_OPTIONS}
            defaultValue={property?.type ?? "studio_unit"}
            error={fieldError("type")}
          />
          <Input
            name="total_units"
            label="Total units"
            type="number"
            min={0}
            defaultValue={property?.total_units ?? 0}
            error={fieldError("total_units")}
          />
          <div className="flex items-center gap-3 pt-2">
            <SubmitButton label={mode === "create" ? "Create Property" : "Save Changes"} />
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push("/property/properties")}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
