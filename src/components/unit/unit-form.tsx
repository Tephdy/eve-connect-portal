"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { createUnitAction, updateUnitAction } from "@/app/(dashboard)/property/units/actions";
import type { ActionResult } from "@/lib/actions/result";
import type { Unit } from "@/lib/db/units";
import type { Property } from "@/lib/db/properties";

const STATUS_OPTIONS = [
  { value: "vacant",       label: "Vacant" },
  { value: "occupied",     label: "Occupied" },
  { value: "reserved",     label: "Reserved" },
  { value: "maintenance",  label: "Maintenance" },
  { value: "unavailable",  label: "Unavailable" },
];

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" loading={pending}>{label}</Button>;
}

export function UnitForm({
  mode,
  unit,
  properties,
}: {
  mode: "create" | "edit";
  unit?: Unit;
  properties: Property[];
}) {
  const router = useRouter();
  const toast = useToast();
  const action = mode === "create" ? createUnitAction : updateUnitAction.bind(null, unit!.id);
  const [state, formAction] = useActionState<ActionResult | null, FormData>(action, null);

  useEffect(() => {
    if (state?.ok) {
      toast.push(mode === "create" ? "Unit created" : "Unit updated", "success");
      if (mode === "edit") router.refresh();
    } else if (state && !state.ok) {
      toast.push(state.error, "error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const fieldError = (k: string) => (state && !state.ok ? state.fieldErrors?.[k] : undefined);

  const propOptions = properties.map((p) => ({ value: p.id, label: p.name }));

  return (
    <Card className="max-w-2xl">
      <CardBody>
        <form action={formAction} className="space-y-4">
          <Select
            name="property_id"
            label="Property"
            options={propOptions}
            placeholder="Select a property"
            defaultValue={unit?.property_id ?? ""}
            error={fieldError("property_id")}
            required
          />
          <Input name="unit_number" label="Unit number" defaultValue={unit?.unit_number ?? ""} error={fieldError("unit_number")} required />
          <div className="grid grid-cols-2 gap-4">
            <Input name="floor" label="Floor" type="number" defaultValue={unit?.floor ?? ""} error={fieldError("floor")} />
            <Input name="bedrooms" label="Bedrooms" type="number" min={0} defaultValue={unit?.bedrooms ?? ""} error={fieldError("bedrooms")} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input name="bathrooms" label="Bathrooms" type="number" step="0.5" min={0} defaultValue={unit?.bathrooms ?? ""} error={fieldError("bathrooms")} />
            <Input name="area_sqm" label="Area (sqm)" type="number" step="0.01" min={0} defaultValue={unit?.area_sqm ?? ""} error={fieldError("area_sqm")} />
          </div>
          <Input name="base_rent" label="Base rent (PHP)" type="number" step="0.01" min={0} defaultValue={unit?.base_rent ?? ""} error={fieldError("base_rent")} />
          <Select name="status" label="Status" options={STATUS_OPTIONS} defaultValue={unit?.status ?? "vacant"} error={fieldError("status")} />
          <div className="flex items-center gap-3 pt-2">
            <SubmitButton label={mode === "create" ? "Create Unit" : "Save Changes"} />
            <Button type="button" variant="secondary" onClick={() => router.push("/property/units")}>
              Cancel
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
