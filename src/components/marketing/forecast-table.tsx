"use client";

import { useState, useTransition, useActionState, useEffect } from "react";
import { DoorOpen, RefreshCw } from "lucide-react";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusPill } from "@/components/dashboard/status-pill";
import { useToast } from "@/components/ui/toast";
import {
  overrideForecastAction,
  recalculateAllAction,
  unreserveUnitAction,
} from "@/app/(dashboard)/marketing/forecast/actions";
import { ReserveDialog } from "./reserve-dialog";
import type { ActionResult } from "@/lib/actions/result";
import type { Forecast } from "@/lib/db/forecast";
import type { Unit } from "@/lib/db/units";
import type { Inquiry } from "@/lib/db/inquiries";

const STATUS_TONE: Record<string, "green" | "brand" | "yellow" | "red" | "gray"> = {
  vacant: "green",
  occupied: "brand",
  reserved: "yellow",
  maintenance: "red",
  unavailable: "gray",
};

export function ForecastTable({
  forecasts,
  units,
  inquiries,
}: {
  forecasts: Forecast[];
  units: Unit[];
  inquiries?: Inquiry[];
}) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const [editing, setEditing] = useState<string | null>(null);
  const [reserving, setReserving] = useState<string | null>(null);

  const map = new Map(forecasts.map((f) => [f.unit_id, f]));

  function recalc() {
    start(async () => {
      try {
        await recalculateAllAction();
        toast.push("Forecasts recalculated", "success");
      } catch {
        toast.push("Failed", "error");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="secondary" onClick={recalc} loading={pending}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          Recalculate all
        </Button>
      </div>

      <Card className="overflow-hidden">
        <CardBody className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Unit</TH>
                <TH>Property</TH>
                <TH>Earliest available</TH>
                <TH>Confidence</TH>
                <TH>Status</TH>
                <TH className="text-right"></TH>
              </TR>
            </THead>
            <TBody>
              {units.map((u) => {
                const f = map.get(u.id);
                return (
                  <TR key={u.id}>
                    <TD>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400">
                          <DoorOpen className="h-4 w-4" />
                        </div>
                        <span className="font-medium text-ink-900">{u.unit_number}</span>
                      </div>
                    </TD>
                    <TD className="text-ink-600">{u.property_name ?? "—"}</TD>
                    <TD>
                      {f ? (
                        <span className="text-sm text-ink-800">
                          {new Date(f.earliest_available_date).toLocaleDateString("en-PH", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      ) : (
                        <span className="text-sm text-ink-400">—</span>
                      )}
                    </TD>
                    <TD>
                      {f ? (
                        <StatusPill tone={f.confidence === "confirmed" ? "green" : "yellow"} dot>
                          {f.confidence}
                        </StatusPill>
                      ) : (
                        <span className="text-sm text-ink-400">—</span>
                      )}
                    </TD>
                    <TD>
                      <StatusPill tone={STATUS_TONE[u.status] ?? "gray"} dot>
                        {u.status}
                      </StatusPill>
                    </TD>
                    <TD className="text-right">
                      <div className="flex justify-end gap-2">
                        {u.status === "reserved" ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              start(async () => {
                                const r = await unreserveUnitAction(u.id);
                                if (r.ok) toast.push("Reservation released", "success");
                                else toast.push(r.error, "error");
                              })
                            }
                          >
                            Unreserve
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setReserving(u.id)}
                            disabled={u.status !== "vacant"}
                          >
                            Reserve
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setEditing(editing === u.id ? null : u.id)}
                        >
                          {editing === u.id ? "Cancel" : "Override"}
                        </Button>
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </CardBody>
      </Card>

      {reserving && (
        <ReserveDialog
          unit={units.find((u) => u.id === reserving)!}
          inquiries={inquiries}
          onClose={() => setReserving(null)}
        />
      )}

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
  unit,
  forecast,
  onClose,
}: {
  unit: Unit;
  forecast?: Forecast;
  onClose: () => void;
}) {
  const toast = useToast();
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    overrideForecastAction,
    null
  );

  useEffect(() => {
    if (state?.ok) {
      toast.push("Forecast updated", "success");
      onClose();
    } else if (state && !state.ok) {
      toast.push(state.error, "error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Card>
      <CardBody>
        <form action={formAction} className="space-y-4">
          <p className="font-semibold text-ink-900">
            Override forecast for Unit {unit.unit_number}
          </p>
          <input type="hidden" name="unit_id" value={unit.id} />
          <div className="grid grid-cols-3 gap-4">
            <Input
              name="earliest_available_date"
              label="Earliest available"
              type="date"
              defaultValue={forecast?.earliest_available_date ?? ""}
              required
            />
            <Select
              name="confidence"
              label="Confidence"
              options={[
                { value: "confirmed", label: "Confirmed" },
                { value: "estimated", label: "Estimated" },
              ]}
              defaultValue={forecast?.confidence ?? "estimated"}
            />
            <Input
              name="notes"
              label="Notes"
              defaultValue={forecast?.notes ?? ""}
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit">Save override</Button>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}