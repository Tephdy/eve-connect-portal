"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { createMeterAction } from "@/app/(dashboard)/property/meters/actions";

const TYPES = [
  { value: "electricity", label: "Electricity" },
  { value: "water", label: "Water" },
  { value: "gas", label: "Gas" },
  { value: "other", label: "Other" },
];

type PropertyOption = { id: string; name: string };
type UnitOption = { id: string; unit_number: string; property_id: string | null };

export function AddMeterDialog({
  properties,
  units,
  defaultUnitId,
}: {
  properties: PropertyOption[];
  units: UnitOption[];
  defaultUnitId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const [propertyId, setPropertyId] = useState<string>("");
  const [unitId, setUnitId] = useState<string>(defaultUnitId ?? "");
  const [utilityType, setUtilityType] = useState("electricity");
  const [meterNumber, setMeterNumber] = useState("");
  const [unitLabel, setUnitLabel] = useState("kWh");
  const [initialReading, setInitialReading] = useState("0");

  const toast = useToast();

  const filteredUnits = propertyId
    ? units.filter((u) => u.property_id === propertyId)
    : units;

  function onPropertyChange(value: string) {
    setPropertyId(value);
    if (value && unitId) {
      const u = units.find((x) => x.id === unitId);
      if (!u || u.property_id !== value) setUnitId("");
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!unitId) {
      toast.push("Pick a unit first", "error");
      return;
    }
    const fd = new FormData();
    fd.set("unit_id", unitId);
    fd.set("utility_type", utilityType);
    fd.set("meter_number", meterNumber);
    fd.set("unit_label", unitLabel);
    fd.set("initial_reading", initialReading);
    start(async () => {
      const r = await createMeterAction(fd);
      if (!r.ok) {
        toast.push(r.error, "error");
        return;
      }
      toast.push("Meter added", "success");
      setOpen(false);
      setMeterNumber("");
      setInitialReading("0");
    });
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus className="mr-1.5 h-3.5 w-3.5" /> Add meter
      </Button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-surface p-5 shadow-lg dark:bg-surface-raised"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Add meter</h2>
          <button
            onClick={() => setOpen(false)}
            className="rounded p-1 text-ink-400 hover:text-ink-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-500">
              Property
            </label>
            <select
              value={propertyId}
              onChange={(e) => onPropertyChange(e.target.value)}
              className="w-full rounded-lg border border-white/60 bg-white/70 px-3 py-1.5 text-sm dark:border-white/[0.08] dark:bg-white/[0.04]"
            >
              <option value="">All properties</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-500">
              Unit
            </label>
            <select
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
              className="w-full rounded-lg border border-white/60 bg-white/70 px-3 py-1.5 text-sm dark:border-white/[0.08] dark:bg-white/[0.04]"
            >
              <option value="">Select unit…</option>
              {filteredUnits.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.unit_number}
                </option>
              ))}
            </select>
            {filteredUnits.length === 0 && (
              <p className="mt-1 text-xs text-ink-500">No units in this property.</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-500">
              Utility type
            </label>
            <select
              value={utilityType}
              onChange={(e) => setUtilityType(e.target.value)}
              className="w-full rounded-lg border border-white/60 bg-white/70 px-3 py-1.5 text-sm dark:border-white/[0.08] dark:bg-white/[0.04]"
            >
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-500">
              Meter number
            </label>
            <input
              type="text"
              value={meterNumber}
              onChange={(e) => setMeterNumber(e.target.value)}
              placeholder="e.g., MTR-001"
              className="w-full rounded-lg border border-white/60 bg-white/70 px-3 py-1.5 text-sm dark:border-white/[0.08] dark:bg-white/[0.04]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-500">
                Unit label
              </label>
              <input
                type="text"
                value={unitLabel}
                onChange={(e) => setUnitLabel(e.target.value)}
                placeholder="kWh / m³"
                className="w-full rounded-lg border border-white/60 bg-white/70 px-3 py-1.5 text-sm dark:border-white/[0.08] dark:bg-white/[0.04]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-500">
                Initial reading
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={initialReading}
                onChange={(e) => setInitialReading(e.target.value)}
                className="w-full rounded-lg border border-white/60 bg-white/70 px-3 py-1.5 text-sm dark:border-white/[0.08] dark:bg-white/[0.04]"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={pending} disabled={!unitId}>
              Add meter
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
