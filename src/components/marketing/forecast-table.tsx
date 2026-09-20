"use client";

import { useState, useTransition } from "react";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { overrideForecastAction, recalculateAllAction } from "@/app/(dashboard)/marketing/forecast/actions";
import type { Forecast } from "@/lib/db/forecast";
import type { Unit } from "@/lib/db/units";

export function ForecastTable({ forecasts, units }: { forecasts: Forecast[]; units: Unit[] }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const [editing, setEditing] = useState<string | null>(null);

  const map = new Map(forecasts.map((f) => [f.unit_id, f]));

  function recalc() {
    start(async () => {
      try {
        await recalculateAllAction();
        toast.push("Forecasts recalculated", "success");
      } catch { toast.push("Failed", "error"); }
    });
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <Button variant="secondary" onClick={recalc} loading={pending}>
          Recalculate all
        </Button>
      </div>
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <Table>
          <THead>
            <TR>
              <TH>Unit</TH><TH>Property</TH>
              <TH>Earliest available</TH><TH>Confidence</TH>
              <TH>Status</TH><TH className="text-right">Action</TH>
            </TR>
          </THead>
          <TBody>
            {units.map((u) => {
              const f = map.get(u.id);
              return (
                <TR key={u.id}>
                  <TD className="font-medium">{u.unit_number}</TD>
                  <TD className="text-gray-600">{u.property_name ?? "—"}</TD>
                  <TD>{f?.earliest_available_date ?? "—"}</TD>
                  <TD>
                    {f ? <Badge tone={f.confidence === "confirmed" ? "green" : "yellow"}>{f.confidence}</Badge> : "—"}
                  </TD>
                  <TD><Badge tone="gray">{u.status}</Badge></TD>
                  <TD className="text-right">
                    <Button size="sm" variant="secondary"
                      onClick={() => setEditing(editing === u.id ? null : u.id)}>
                      {editing === u.id ? "Cancel" : "Override"}
                    </Button>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </div>

      {editing && (
        <OverrideForm
          unit={units.find((u) => u.id === editing)!}
          forecast={map.get(editing)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function OverrideForm({
  unit, forecast, onClose,
}: { unit: Unit; forecast?: Forecast; onClose: () => void }) {
  const toast = useToast();
  const [state, formAction] = useOverrideAction(onClose);

  return (
    <form action={formAction} className="bg-white border border-gray-200 rounded-lg p-5 mt-4 space-y-3">
      <p className="font-medium">Override forecast for Unit {unit.unit_number}</p>
      <input type="hidden" name="unit_id" value={unit.id} />
      <div className="grid grid-cols-3 gap-3">
        <Input name="earliest_available_date" label="Earliest available" type="date"
          defaultValue={forecast?.earliest_available_date ?? ""} required />
        <Select name="confidence" label="Confidence"
          options={[{ value: "confirmed", label: "Confirmed" }, { value: "estimated", label: "Estimated" }]}
          defaultValue={forecast?.confidence ?? "estimated"} />
        <Input name="notes" label="Notes" defaultValue={forecast?.notes ?? ""} />
      </div>
      <div className="flex gap-2">
        <Button type="submit">Save override</Button>
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
      </div>
    </form>
  );
}

function useOverrideAction(onSuccess: () => void) {
  const toast = useToast();
  const [state, formAction] = useActionState<ActionResult | null, FormData>(overrideForecastAction, null);

  useEffect(() => {
    if (state?.ok) {
      toast.push("Forecast updated", "success");
      onSuccess();
    } else if (state && !state.ok) toast.push(state.error, "error");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return [state, formAction] as const;
}

// Local imports to avoid circular
import { useActionState, useEffect } from "react";
import type { ActionResult } from "@/lib/actions/result";
