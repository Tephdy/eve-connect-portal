// @@CONTRACT_ENGINE:reservation-edit-form
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { updateReservationAction } from "../../actions";
import type { UnitReservation } from "@/lib/db/unit-reservations";

const PAYMENT_MODES = [
  { value: "", label: "— Select mode —" },
  { value: "cash", label: "Cash" },
  { value: "gcash", label: "GCash" },
  { value: "bank", label: "Bank transfer" },
  { value: "check", label: "Check" },
  { value: "other", label: "Other" },
];

const INTENTS = [
  { value: "", label: "— Select intent —" },
  { value: "new", label: "New" },
  { value: "renew", label: "Renew" },
  { value: "extend", label: "Extend" },
];

const TERMS = [
  { value: "", label: "— Select term —" },
  { value: "1_month", label: "1 month" },
  { value: "3_months", label: "3 months" },
  { value: "6_months", label: "6 months" },
  { value: "1_year", label: "1 year" },
  { value: "2_years", label: "2 years" },
  { value: "3_years", label: "3 years" },
  { value: "other", label: "Other" },
];

const LEASE_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
];

type AddOn = { label: string; amount: string };

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-b border-ink-100 pb-1 pt-3 dark:border-white/[0.06]">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink-500">
        {children}
      </h3>
    </div>
  );
}

export function EditForm({ reservation }: { reservation: UnitReservation }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  const [addOns, setAddOns] = useState<AddOn[]>(
    (reservation.add_ons ?? []).map((a) => ({
      label: a.label ?? "",
      amount: String(a.amount ?? 0),
    }))
  );

  function addAddOn() {
    setAddOns((prev) => [...prev, { label: "", amount: "" }]);
  }
  function updateAddOn(i: number, patch: Partial<AddOn>) {
    setAddOns((prev) => prev.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
  }
  function removeAddOn(i: number) {
    setAddOns((prev) => prev.filter((_, idx) => idx !== i));
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    // Ensure add-ons are attached as repeated fields
    for (const a of addOns) {
      if (!a.label.trim()) continue;
      fd.append("add_on_label", a.label);
      fd.append("add_on_amount", a.amount || "0");
    }

    start(async () => {
      const r = await updateReservationAction(reservation.id, fd);
      if (!r.ok) {
        toast.push(r.error, "error");
        return;
      }
      toast.push("Reservation updated", "success");
      router.push(`/marketing/reservations/${reservation.id}`);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-ink-200 bg-surface p-5 shadow-sm dark:border-white/[0.06]">
      <SectionTitle>Client</SectionTitle>
      <Input name="client_name" label="Client name" required defaultValue={reservation.client_name} />
      <div className="grid grid-cols-2 gap-3">
        <Input name="client_phone" label="Phone" defaultValue={reservation.client_phone ?? ""} />
        <Input name="client_email" type="email" label="Email" defaultValue={reservation.client_email ?? ""} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input name="gender" label="Gender" defaultValue={reservation.gender ?? ""} />
        <Input name="company" label="Company" defaultValue={reservation.company ?? ""} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input name="position" label="Position" defaultValue={reservation.position ?? ""} />
        <Input name="vehicle_plate" label="Vehicle plate" defaultValue={reservation.vehicle_plate ?? ""} />
      </div>
      <Input
        name="declared_occupants"
        type="number"
        min="1"
        label="Declared occupants"
        defaultValue={String(reservation.declared_occupants ?? 1)}
      />

      <SectionTitle>Reservation</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <Input
          name="reservation_fee"
          type="number"
          step="0.01"
          min="0"
          label="Reservation fee"
          defaultValue={reservation.reservation_fee != null ? String(reservation.reservation_fee) : ""}
        />
        <Select name="payment_mode" label="Mode of payment" options={PAYMENT_MODES} defaultValue={reservation.payment_mode ?? ""} />
      </div>
      <Input name="reference_number" label="Reference number" defaultValue={reservation.reference_number ?? ""} />

      <SectionTitle>Lease draft</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <Select name="intent" label="Intent" options={INTENTS} defaultValue={reservation.intent ?? ""} />
        <Select name="term" label="Term" options={TERMS} defaultValue={reservation.term ?? ""} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input name="lease_start_date" type="date" label="Lease start" defaultValue={reservation.lease_start_date ?? ""} />
        <Input name="lease_end_date" type="date" label="Lease end" defaultValue={reservation.lease_end_date ?? ""} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input name="move_in_date" type="date" label="Move-in date" defaultValue={reservation.move_in_date ?? ""} />
        <Input name="rent_due_date" type="date" label="Rent due date" defaultValue={reservation.rent_due_date ?? ""} />
      </div>
      <Input
        name="monthly_rent"
        type="number"
        step="0.01"
        min="0"
        label="Monthly rent"
        defaultValue={reservation.monthly_rent != null ? String(reservation.monthly_rent) : ""}
      />
      <div className="grid grid-cols-2 gap-3">
        <Input
          name="deposit_1"
          type="number"
          step="0.01"
          min="0"
          label="1st deposit"
          defaultValue={reservation.deposit_1 != null ? String(reservation.deposit_1) : ""}
        />
        <Input
          name="deposit_1_due_date"
          type="date"
          label="1st deposit due"
          defaultValue={reservation.deposit_1_due_date ?? ""}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input
          name="deposit_2"
          type="number"
          step="0.01"
          min="0"
          label="2nd deposit"
          defaultValue={reservation.deposit_2 != null ? String(reservation.deposit_2) : ""}
        />
        <Input
          name="deposit_2_due_date"
          type="date"
          label="2nd deposit due"
          defaultValue={reservation.deposit_2_due_date ?? ""}
        />
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="block text-xs font-semibold text-ink-500">Add-ons</label>
          <button
            type="button"
            onClick={addAddOn}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-medium text-brand-600 hover:bg-brand-500/10 dark:text-brand-400"
          >
            <Plus className="h-3 w-3" />
            Add
          </button>
        </div>
        {addOns.length === 0 ? (
          <p className="text-xs text-ink-400">No add-ons.</p>
        ) : (
          <div className="space-y-2">
            {addOns.map((a, i) => (
              <div key={i} className="flex items-end gap-2">
                <div className="flex-1">
                  <input
                    type="text"
                    value={a.label}
                    onChange={(e) => updateAddOn(i, { label: e.target.value })}
                    placeholder="Label"
                    className="w-full rounded-lg border border-white/60 bg-white/70 px-3 py-1.5 text-sm dark:border-white/[0.08] dark:bg-white/[0.04]"
                  />
                </div>
                <div className="w-32">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={a.amount}
                    onChange={(e) => updateAddOn(i, { amount: e.target.value })}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-white/60 bg-white/70 px-3 py-1.5 text-right text-sm tabular-nums dark:border-white/[0.08] dark:bg-white/[0.04]"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeAddOn(i)}
                  className="rounded-lg p-2 text-ink-400 hover:bg-danger-500/10 hover:text-danger-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input
          name="notice_period_days"
          type="number"
          min="0"
          label="Notice period (days)"
          defaultValue={reservation.notice_period_days != null ? String(reservation.notice_period_days) : ""}
        />
        <Select name="lease_status" label="Lease status" options={LEASE_STATUSES} defaultValue={reservation.lease_status} />
      </div>

      <div className="flex justify-end gap-2 pt-3">
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          Save changes
        </Button>
      </div>
    </form>
  );
}
