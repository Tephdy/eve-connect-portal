"use client";

import { useState, useTransition } from "react";
import type { BillingRow, UtilityType } from "@/lib/db/utilities";
import { formatPHP } from "@/lib/utils/format-php";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  saveReadingRowAction,
  makeInvoiceAction,
} from "@/app/(dashboard)/property/utilities/readings/actions";

type RowState = {
  current: string;
  penalty: string;
  remarks: string;
  orNumber: string;
  saving: boolean;
  saved: boolean;
  savedReadingId?: string;
  error: string | null;
  invoiceId: string | null;
  invoiceNumber: string | null;
};

export function ReadingsGrid({
  utilityType,
  asOfDate,
  ratePerUnit,
  rateWarning,
  rows,
}: {
  propertyId: string;
  utilityType: UtilityType;
  asOfDate: string;
  ratePerUnit: number | null;
  rateWarning: string | null;
  rows: BillingRow[];
}) {
  const { toast } = useToast();
  const [, startTransition] = useTransition();
  const [date, setDate] = useState(asOfDate);
  const [state, setState] = useState<Record<string, RowState>>(() =>
    Object.fromEntries(
      rows.map((r) => [
        r.meter_id,
        {
          current: "",
          penalty: r.latest_penalty != null ? String(r.latest_penalty) : "0",
          remarks: r.latest_remarks ?? "",
          orNumber: r.latest_or_number ?? "",
          saving: false,
          saved: false,
          error: null,
          invoiceId: r.latest_invoice_id,
          invoiceNumber: null,
        } as RowState,
      ])
    )
  );

  const update = (meterId: string, patch: Partial<RowState>) =>
    setState((s) => ({ ...s, [meterId]: { ...s[meterId], ...patch } }));

  const computeConsumption = (r: BillingRow, current: string) => {
    const c = Number(current);
    if (!Number.isFinite(c) || current === "") return null;
    return Math.max(0, c - r.previous_reading);
  };

  const computeDue = (consumption: number | null) => {
    if (consumption == null || ratePerUnit == null) return null;
    return consumption * ratePerUnit;
  };

  const handleSave = (r: BillingRow) => {
    const s = state[r.meter_id];
    const current = Number(s.current);
    if (!Number.isFinite(current) || current < 0) {
      update(r.meter_id, { error: "Current reading must be a number" });
      return;
    }
    if (ratePerUnit == null) {
      update(r.meter_id, { error: "No rate configured" });
      return;
    }

    update(r.meter_id, { saving: true, error: null });
    startTransition(async () => {
      const res = await saveReadingRowAction({
        meter_id: r.meter_id,
        reading: current,
        reading_date: date,
        penalty_amount: Number(s.penalty) || 0,
        remarks: s.remarks || null,
        or_number: s.orNumber || null,
        rate_snapshot: ratePerUnit,
      });
      if (!res.ok) {
        update(r.meter_id, { saving: false, error: res.error });
        toast("Save failed: " + res.error, "error");
        return;
      }
      update(r.meter_id, {
        saving: false,
        saved: true,
        error: null,
        savedReadingId: res.data.id,
      });
      toast("Saved " + r.unit_number + " updated", "success");
    });
  };

  const handleMakeInvoice = (r: BillingRow) => {
    const s = state[r.meter_id];
    if (!s.saved || !s.savedReadingId) {
      update(r.meter_id, { error: "Save the reading first" });
      return;
    }
    const due = new Date(date);
    due.setDate(due.getDate() + 30);
    const dueStr = due.toISOString().slice(0, 10);

    startTransition(async () => {
      const res = await makeInvoiceAction({
        reading_id: s.savedReadingId!,
        due_date: dueStr,
      });
      if (!res.ok) {
        update(r.meter_id, { error: res.error });
        toast("Invoice failed: " + res.error, "error");
        return;
      }
      update(r.meter_id, {
        invoiceId: res.data.invoice_id,
        invoiceNumber: res.data.display_number,
      });
      toast("Invoice created: " + res.data.display_number, "success");
    });
  };

  if (rows.length === 0) {
    return (
      <div className="p-6 text-sm text-ink-500">
        No active {utilityType} meters for this property.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      {rateWarning && (
        <div className="border-b border-warn-200 bg-warn-50 px-4 py-2 text-xs text-warn-800">
          {rateWarning}
        </div>
      )}

      <div className="flex items-center gap-3 border-b border-line-200 px-4 py-3">
        <label className="text-xs font-medium text-ink-600">
          Reading date
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="ml-2 rounded border border-line-300 px-2 py-1 text-sm"
          />
        </label>
        {ratePerUnit != null && (
          <span className="text-xs text-ink-500">
            Rate: <b>{formatPHP(ratePerUnit)}</b> per{" "}
            {utilityType === "water" ? "cu.m" : "kWh"}
          </span>
        )}
      </div>

      <table className="w-full text-sm">
        <thead className="bg-surface-50 text-xs uppercase tracking-wide text-ink-500">
          <tr>
            <th className="px-3 py-2 text-left">Unit / Name</th>
            <th className="px-3 py-2 text-right">Previous</th>
            <th className="px-3 py-2 text-right">Current</th>
            <th className="px-3 py-2 text-right">Consumption</th>
            <th className="px-3 py-2 text-right">Tenant due</th>
            <th className="px-3 py-2 text-right">w/Penalty</th>
            <th className="px-3 py-2 text-right">Per cubic</th>
            <th className="px-3 py-2 text-left">Remarks</th>
            <th className="px-3 py-2 text-left">OR Number</th>
            <th className="px-3 py-2 text-right">Make invoice</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const s = state[r.meter_id];
            const consumption = computeConsumption(r, s.current);
            const due = computeDue(consumption);
            const penalty = Number(s.penalty) || 0;
            const total = due != null ? due + penalty : null;

            return (
              <tr key={r.meter_id} className="border-t border-line-100">
                <td className="px-3 py-2">
                  <div className="font-medium">{r.unit_number ?? "-"}</div>
                  <div className="text-xs text-ink-500">
                    {r.tenant_name ?? "Vacant"}
                  </div>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {r.previous_reading}
                </td>
                <td className="px-3 py-2 text-right">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={s.current}
                    onChange={(e) =>
                      update(r.meter_id, { current: e.target.value })
                    }
                    className="w-24 text-right tabular-nums"
                  />
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {consumption != null ? consumption.toFixed(2) : "-"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {due != null ? formatPHP(due) : "-"}
                </td>
                <td className="px-3 py-2 text-right">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={s.penalty}
                    onChange={(e) =>
                      update(r.meter_id, { penalty: e.target.value })
                    }
                    className="w-24 text-right tabular-nums"
                  />
                  {total != null && penalty > 0 && (
                    <div className="mt-1 text-xs text-ink-500 tabular-nums">
                      = {formatPHP(total)}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-ink-600">
                  {ratePerUnit != null ? formatPHP(ratePerUnit) : "-"}
                </td>
                <td className="px-3 py-2">
                  <Input
                    value={s.remarks}
                    onChange={(e) =>
                      update(r.meter_id, { remarks: e.target.value })
                    }
                    className="w-40"
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    value={s.orNumber}
                    onChange={(e) =>
                      update(r.meter_id, { orNumber: e.target.value })
                    }
                    className="w-32"
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleSave(r)}
                      disabled={s.saving}
                    >
                      {s.saving ? "Saving..." : s.saved ? "Saved" : "Save"}
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => handleMakeInvoice(r)}
                      disabled={!s.saved || !!s.invoiceId}
                    >
                      {s.invoiceId
                        ? "Invoiced"
                        : s.invoiceNumber
                        ? s.invoiceNumber
                        : "Make invoice"}
                    </Button>
                  </div>
                  {s.error && (
                    <div className="mt-1 text-xs text-danger-600">
                      {s.error}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
