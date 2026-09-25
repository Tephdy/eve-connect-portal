"use client";

import { useState, useTransition } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { reserveUnitAction } from "@/app/(dashboard)/marketing/forecast/actions";
import type { Unit } from "@/lib/db/units";
import type { Inquiry } from "@/lib/db/inquiries";

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
  { value: "draft", label: "Draft (available later in New Lease)" },
  { value: "active", label: "Active" },
];

type AddOn = { label: string; amount: string };

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-b border-white/40 pb-1 pt-2 dark:border-white/[0.06]">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink-500">
        {children}
      </h3>
    </div>
  );
}

export function ReserveUnitDialog({
  units,
  inquiries,
  onClose,
}: {
  units: Unit[];
  inquiries?: Inquiry[];
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const toast = useToast();

  // Unit picker state
  const [unitId, setUnitId] = useState("");

  // Client
  const [inquiryId, setInquiryId] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");

  // Reservation
  const [fee, setFee] = useState("");
  const [mode, setMode] = useState("");
  const [reference, setReference] = useState("");

  // Lease draft
  const [intent, setIntent] = useState("");
  const [term, setTerm] = useState("");
  const [leaseStart, setLeaseStart] = useState("");
  const [leaseEnd, setLeaseEnd] = useState("");
  const [moveIn, setMoveIn] = useState("");
  const [rentDue, setRentDue] = useState("");
  const [monthlyRent, setMonthlyRent] = useState("");
  const [dep1, setDep1] = useState("");
  const [dep2, setDep2] = useState("");
  const [dep1Due, setDep1Due] = useState("");
  const [dep2Due, setDep2Due] = useState("");
  const [addOns, setAddOns] = useState<AddOn[]>([]);
  const [notice, setNotice] = useState("");
  const [leaseStatus, setLeaseStatus] = useState("draft");
  const [receiptFiles, setReceiptFiles] = useState<File[]>([]);

  const addOnsTotal = addOns.reduce((s, a) => s + (Number(a.amount) || 0), 0);

  function applyInquiry(id: string) {
    setInquiryId(id);
    if (!id || !inquiries) return;
    const inq = inquiries.find((x) => x.id === id);
    if (!inq) return;
    setClientName(inq.prospect_name ?? "");
    setClientPhone(inq.contact ?? "");
    setClientEmail(inq.email ?? "");
  }

  function addAddOn() {
    setAddOns((prev) => [...prev, { label: "", amount: "" }]);
  }
  function updateAddOn(i: number, patch: Partial<AddOn>) {
    setAddOns((prev) => prev.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
  }
  function removeAddOn(i: number) {
    setAddOns((prev) => prev.filter((_, idx) => idx !== i));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!unitId) { toast.push("Pick a unit first", "error"); return; }
    if (!clientName) { toast.push("Client name is required", "error"); return; }

    const fd = new FormData();
    fd.set("unit_id", unitId);
    fd.set("client_name", clientName);
    fd.set("client_phone", clientPhone);
    fd.set("client_email", clientEmail);
    fd.set("reservation_fee", fee);
    fd.set("payment_mode", mode);
    fd.set("reference_number", reference);
    if (inquiryId) fd.set("reserve_inquiry_id", inquiryId);

    fd.set("intent", intent);
    fd.set("term", term);
    fd.set("lease_start_date", leaseStart);
    fd.set("lease_end_date", leaseEnd);
    fd.set("move_in_date", moveIn);
    fd.set("rent_due_date", rentDue);
    fd.set("monthly_rent", monthlyRent);
    fd.set("deposit_1", dep1);
    fd.set("deposit_2", dep2);
    fd.set("deposit_1_due_date", dep1Due);
    fd.set("deposit_2_due_date", dep2Due);
    for (const a of addOns) {
      if (!a.label.trim()) continue;
      fd.append("add_on_label", a.label);
      fd.append("add_on_amount", a.amount || "0");
    }
    fd.set("notice_period_days", notice);
    fd.set("lease_status", leaseStatus);

    // Attach receipt files to the payload
    for (const f of receiptFiles) {
      fd.append("receipt_files", f);
    }

    start(async () => {
      const r = await reserveUnitAction(null, fd);
      if (!r.ok) { toast.push(r.error, "error"); return; }
      toast.push("Unit reserved", "success");
      onClose();
    });
  }

  // Group units by property
  const byProperty = new Map<string, Unit[]>();
  for (const u of units) {
    const key = u.property_name ?? "Unassigned";
    if (!byProperty.has(key)) byProperty.set(key, []);
    byProperty.get(key)!.push(u);
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="my-8 w-full max-w-3xl rounded-2xl bg-surface p-5 shadow-xl dark:bg-surface-raised"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Reserve a unit</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-ink-400 hover:text-ink-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <SectionTitle>Unit</SectionTitle>

          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-500">
              Unit (grouped by property)
            </label>
            <select
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
              className="w-full rounded-lg border border-white/60 bg-white/70 px-3 py-1.5 text-sm dark:border-white/[0.08] dark:bg-white/[0.04]"
              required
            >
              <option value="">— Select a unit —</option>
              {Array.from(byProperty.entries()).map(([propName, propUnits]) => (
                <optgroup key={propName} label={propName}>
                  {propUnits.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.unit_number}
                      {u.status === "occupied" ? " (Occupied)" : ""}
                      {u.status === "maintenance" ? " (Maintenance)" : ""}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <p className="mt-1 text-xs text-ink-500">
              Occupied units can be reserved in advance for the next tenant.
            </p>
          </div>

          <SectionTitle>Client</SectionTitle>

          {inquiries && inquiries.length > 0 && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-500">
                From inquiry (optional)
              </label>
              <select
                value={inquiryId}
                onChange={(e) => applyInquiry(e.target.value)}
                className="w-full rounded-lg border border-white/60 bg-white/70 px-3 py-1.5 text-sm dark:border-white/[0.08] dark:bg-white/[0.04]"
              >
                <option value="">— Select an inquiry —</option>
                {inquiries.map((inq) => (
                  <option key={inq.id} value={inq.id}>
                    {inq.prospect_name}
                    {inq.unit_number ? " (Unit " + inq.unit_number + ")" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          <Input
            label="Client name"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            required
            placeholder="Full name of client / tenant"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Phone"
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              placeholder="0917..."
            />
            <Input
              label="Email"
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              placeholder="name@example.com"
            />
          </div>

          <SectionTitle>Reservation</SectionTitle>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Reservation fee"
              type="number"
              step="0.01"
              min="0"
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              placeholder="0.00"
            />
            <Select
              label="Mode of payment"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              options={PAYMENT_MODES}
            />
          </div>
          <Input
            label="Reference number"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="GCash ref / bank ref / OR number"
          />

          <SectionTitle>Receipt (optional)</SectionTitle>
          <div>
            <label className="mb-2 block text-xs font-medium text-ink-600">
              Attach GCash screenshot, bank slip, or OR
            </label>
            <input
              type="file"
              name="receipt_files"
              multiple
              accept="image/*,application/pdf"
              onChange={(e) => {
                setReceiptFiles(Array.from(e.target.files ?? []));
              }}
              className="block w-full rounded-lg border border-white/60 bg-white/70 px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-500 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-brand-600 dark:border-white/[0.08] dark:bg-white/[0.04]"
            />
            {receiptFiles.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-ink-500">
                {receiptFiles.map((f, i) => (
                  <li key={i}>
                    {f.name} ({Math.round(f.size / 1024)} KB)
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-1 text-xs text-ink-400">
              Files go to Google Drive and appear in the receipts module.
            </p>
          </div>

          <SectionTitle>Lease draft</SectionTitle>

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Intent"
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              options={INTENTS}
            />
            <Select
              label="Term"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              options={TERMS}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Lease start date" type="date" value={leaseStart} onChange={(e) => setLeaseStart(e.target.value)} />
            <Input label="Lease end date" type="date" value={leaseEnd} onChange={(e) => setLeaseEnd(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Move-in date" type="date" value={moveIn} onChange={(e) => setMoveIn(e.target.value)} />
            <Input label="Rent due date" type="date" value={rentDue} onChange={(e) => setRentDue(e.target.value)} />
          </div>

          <Input
            label="Monthly rent"
            type="number"
            step="0.01"
            min="0"
            value={monthlyRent}
            onChange={(e) => setMonthlyRent(e.target.value)}
            placeholder="0.00"
          />

          <div className="grid grid-cols-2 gap-3">
            <Input label="1st deposit" type="number" step="0.01" min="0" value={dep1} onChange={(e) => setDep1(e.target.value)} placeholder="0.00" />
            <Input label="1st deposit due date" type="date" value={dep1Due} onChange={(e) => setDep1Due(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="2nd deposit" type="number" step="0.01" min="0" value={dep2} onChange={(e) => setDep2(e.target.value)} placeholder="0.00" />
            <Input label="2nd deposit due date" type="date" value={dep2Due} onChange={(e) => setDep2Due(e.target.value)} />
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
                <p className="text-right text-xs font-semibold text-ink-600">
                  Add-ons total: ₱{addOnsTotal.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Notice period (days)" type="number" min="0" value={notice} onChange={(e) => setNotice(e.target.value)} placeholder="e.g., 30" />
            <Select label="Lease status" value={leaseStatus} onChange={(e) => setLeaseStatus(e.target.value)} options={LEASE_STATUSES} />
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={pending} disabled={!unitId || !clientName}>Reserve unit</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
