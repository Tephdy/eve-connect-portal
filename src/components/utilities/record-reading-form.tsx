"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { recordReadingAction } from "@/app/(dashboard)/property/meters/actions";

export function RecordReadingForm({ meter_id }: { meter_id: string }) {
  const [pending, start] = useTransition();
  const [reading, setReading] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const toast = useToast();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("meter_id", meter_id);
    fd.set("reading", reading);
    fd.set("reading_date", date);
    fd.set("notes", notes);
    start(async () => {
      const r = await recordReadingAction(fd);
      if (!r.ok) {
        toast.push(r.error, "error");
        return;
      }
      toast.push("Reading recorded", "success");
      setReading("");
      setNotes("");
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3 p-4">
      <div className="w-40">
        <label className="mb-1 block text-xs font-semibold text-ink-500">Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full rounded-lg border border-white/60 bg-white/70 px-3 py-1.5 text-sm dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-ink-100"
        />
      </div>
      <div className="w-40">
        <label className="mb-1 block text-xs font-semibold text-ink-500">Reading</label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={reading}
          onChange={(e) => setReading(e.target.value)}
          placeholder="0.00"
          className="w-full rounded-lg border border-white/60 bg-white/70 px-3 py-1.5 text-sm dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-ink-100"
        />
      </div>
      <div className="min-w-[200px] flex-1">
        <label className="mb-1 block text-xs font-semibold text-ink-500">Notes (optional)</label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g., Meralco reading"
          className="w-full rounded-lg border border-white/60 bg-white/70 px-3 py-1.5 text-sm dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-ink-100"
        />
      </div>
      <Button type="submit" loading={pending} disabled={!reading || !date}>
        Record reading
      </Button>
    </form>
  );
}
