"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { createRateAction } from "@/app/(dashboard)/property/utilities/rates/actions";

const TYPES = [
  { value: "electricity", label: "Electricity" },
  { value: "water", label: "Water" },
  { value: "gas", label: "Gas" },
  { value: "other", label: "Other" },
];

export function AddRateDialog({
  properties,
}: {
  properties: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [property_id, setPropertyId] = useState("");
  const [utility_type, setUtilityType] = useState("electricity");
  const [rate_per_unit, setRate] = useState("");
  const [effective_from, setFrom] = useState(new Date().toISOString().slice(0, 10));
  const toast = useToast();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("property_id", property_id);
    fd.set("utility_type", utility_type);
    fd.set("rate_per_unit", rate_per_unit);
    fd.set("effective_from", effective_from);
    start(async () => {
      const r = await createRateAction(fd);
      if (!r.ok) {
        toast.push(r.error, "error");
        return;
      }
      toast.push("Rate added", "success");
      setOpen(false);
      setRate("");
    });
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus className="mr-1.5 h-3.5 w-3.5" /> Add rate
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
      <div className="w-full max-w-md rounded-2xl bg-surface p-5 shadow-lg dark:bg-surface-raised" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Add utility rate</h2>
          <button onClick={() => setOpen(false)} className="rounded p-1 text-ink-400 hover:text-ink-700">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-500">Property</label>
            <select
              value={property_id}
              onChange={(e) => setPropertyId(e.target.value)}
              className="w-full rounded-lg border border-white/60 bg-white/70 px-3 py-1.5 text-sm dark:border-white/[0.08] dark:bg-white/[0.04]"
            >
              <option value="">All properties (global default)</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-500">Utility type</label>
            <select
              value={utility_type}
              onChange={(e) => setUtilityType(e.target.value)}
              className="w-full rounded-lg border border-white/60 bg-white/70 px-3 py-1.5 text-sm dark:border-white/[0.08] dark:bg-white/[0.04]"
            >
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-500">Rate per unit (₱)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={rate_per_unit}
                onChange={(e) => setRate(e.target.value)}
                placeholder="12.00"
                className="w-full rounded-lg border border-white/60 bg-white/70 px-3 py-1.5 text-sm dark:border-white/[0.08] dark:bg-white/[0.04]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-500">Effective from</label>
              <input
                type="date"
                value={effective_from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full rounded-lg border border-white/60 bg-white/70 px-3 py-1.5 text-sm dark:border-white/[0.08] dark:bg-white/[0.04]"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={pending}>Add rate</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
