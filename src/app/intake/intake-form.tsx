"use client";

import { useRef, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { submitIntakeAction } from "./actions";

const BUILDINGS = [
  "ADI 168", "BED AND BATH", "DREAM", "ECO 1", "ECO 2",
  "GREEN", "HOMEY", "KALAYAAN 888", "PENTHAUZ", "PLEASANT",
];

const PRESET_ADD_ONS = [
  "Foam",
  "Aircon",
  "Bedframe",
  "Electric Fan",
  "Monoblock",
] as const;

const INSPECTION_ITEMS = [
  { key: "switches", label: "Switches" },
  { key: "sockets", label: "Sockets" },
  { key: "cabinet", label: "Cabinet" },
  { key: "lavatory", label: "Lavatory" },
  { key: "light_bulb", label: "Light bulb" },
  { key: "faucets", label: "Faucets" },
  { key: "shower_head", label: "Shower head" },
  { key: "declogging", label: "Declogging" },
  { key: "toilet_bowl", label: "Toilet bowl" },
  { key: "kitchen_sink", label: "Kitchen sink" },
  { key: "wall_paint", label: "Wall paint" },
  { key: "optional_items", label: "Optional items" },
  { key: "door", label: "Door" },
];

type PresetRow = { label: string; checked: boolean; amount: string };
type CustomRow = { text: string; amount: string };

export function IntakeForm({ defaultBuilding }: { defaultBuilding?: string }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const signatureRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef({ x: 0, y: 0 });
  const [hasSignature, setHasSignature] = useState(false);

  // ---- Add-ons state ----
  const [presets, setPresets] = useState<PresetRow[]>(
    PRESET_ADD_ONS.map((label) => ({ label, checked: false, amount: "" }))
  );
  const [otherEnabled, setOtherEnabled] = useState(false);
  const [customs, setCustoms] = useState<CustomRow[]>([{ text: "", amount: "" }]);

  const togglePreset = (label: string) => {
    setPresets((rows) =>
      rows.map((r) => (r.label === label ? { ...r, checked: !r.checked } : r))
    );
  };

  const setPresetAmount = (label: string, value: string) => {
    setPresets((rows) =>
      rows.map((r) => (r.label === label ? { ...r, amount: value } : r))
    );
  };

  const toggleOther = () => {
    setOtherEnabled((v) => {
      if (!v && customs.length === 0) setCustoms([{ text: "", amount: "" }]);
      return !v;
    });
  };

  const addCustom = () =>
    setCustoms((rows) => [...rows, { text: "", amount: "" }]);

  const removeCustom = (idx: number) =>
    setCustoms((rows) => {
      const next = rows.filter((_, i) => i !== idx);
      return next.length === 0 ? [{ text: "", amount: "" }] : next;
    });

  const updateCustom = (idx: number, patch: Partial<CustomRow>) =>
    setCustoms((rows) =>
      rows.map((r, i) => (i === idx ? { ...r, ...patch } : r))
    );

  // ---- Compute add-ons payload ----
  const buildAddOnsPayload = () => {
    const rows: { text: string; amount: number }[] = [];

    for (const p of presets) {
      if (!p.checked) continue;
      const amt = Number(p.amount);
      rows.push({
        text: p.label,
        amount: Number.isFinite(amt) && amt >= 0 ? amt : 0,
      });
    }

    if (otherEnabled) {
      for (const c of customs) {
        const text = c.text.trim();
        if (!text) continue;
        const amt = Number(c.amount);
        rows.push({
          text,
          amount: Number.isFinite(amt) && amt >= 0 ? amt : 0,
        });
      }
    }

    return rows;
  };

  // ---- Canvas handlers ----
  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = signatureRef.current;
    if (!canvas) return;
    drawingRef.current = true;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    lastRef.current = { x, y };
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.beginPath();
    ctx.arc(x, y, 1.5, 0, 2 * Math.PI);
    ctx.fillStyle = "#0b2a4a";
    ctx.fill();
    setHasSignature(true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const canvas = signatureRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(lastRef.current.x, lastRef.current.y);
    ctx.lineTo(x, y);
    ctx.strokeStyle = "#0b2a4a";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    lastRef.current = { x, y };
  };

  const onPointerUp = () => { drawingRef.current = false; };

  const clearSignature = () => {
    const canvas = signatureRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  // ---- Submit ----
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors({});

    const canvas = signatureRef.current;
    if (!canvas) return;
    if (!hasSignature) {
      setErrors({ signature: "Signature is required" });
      toast.push("Please sign the form", "error");
      return;
    }

    const fd = new FormData(e.currentTarget);
    fd.set("signature", canvas.toDataURL("image/png"));
    // Serialize add-ons as JSON array of {text, amount}
    fd.set("ad_ons", JSON.stringify(buildAddOnsPayload()));

    start(async () => {
      const res = await submitIntakeAction(fd);
      if (!res.ok) {
        if (res.fieldErrors) setErrors(res.fieldErrors);
        toast.push(res.error, "error");
        return;
      }
      setSubmitted(true);
      toast.push("Submission received", "success");
    });
  };

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-8 text-center">
        <h2 className="text-xl font-semibold text-emerald-800 dark:text-emerald-400">
          Thank you
        </h2>
        <p className="mt-3 text-sm text-ink-700 dark:text-ink-300">
          Your intake form has been received. Management will contact you
          shortly to confirm your lease.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* Honeypot */}
      <div style={{ position: "absolute", left: "-10000px", top: "auto" }} aria-hidden="true">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {/* ---- Property + Unit ---- */}
      <SectionCard title="Property & unit">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-700">Property *</label>
            <select
              name="building"
              defaultValue={defaultBuilding ?? ""}
              required
              className="h-9 w-full rounded-md border border-ink-200 bg-surface px-3 text-sm text-ink-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-white/[0.06]"
            >
              <option value="">— Select —</option>
              {BUILDINGS.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            {errors.building && <p className="mt-1 text-xs text-danger-600">{errors.building}</p>}
          </div>
          <Input name="unit_no" label="Unit number *" required error={errors.unit_no} />
        </div>
      </SectionCard>

      {/* ---- Personal ---- */}
      <SectionCard title="Personal information">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input name="last_name" label="Last name *" required error={errors.last_name} />
          <Input name="first_name" label="First name *" required error={errors.first_name} />
          <Input name="middle_name" label="Middle name" error={errors.middle_name} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input name="age" label="Age" error={errors.age} />
          <Input name="gender" label="Gender" error={errors.gender} />
          <Input name="civil_status" label="Civil status" error={errors.civil_status} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input name="nationality" label="Nationality" error={errors.nationality} />
          <Input name="religion" label="Religion" error={errors.religion} />
        </div>
        <Input name="perm_address" label="Permanent address" error={errors.perm_address} />
        <Input name="rec_address" label="Recent address" error={errors.rec_address} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input name="mobile" label="Mobile number *" required error={errors.mobile} />
          <Input name="messenger" label="FB / Messenger" error={errors.messenger} />
          <Input name="email" type="email" label="Email *" required error={errors.email} />
        </div>
      </SectionCard>

      {/* ---- Employment ---- */}
      <SectionCard title="Employment (if applicable)">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input name="company" label="Company" error={errors.company} />
          <Input name="work_status" label="Work status" error={errors.work_status} />
          <Input name="position" label="Position" error={errors.position} />
        </div>
        <Input name="comp_addr" label="Company address" error={errors.comp_addr} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input name="comp_tel" label="Company tel." error={errors.comp_tel} />
          <Input name="comp_email" label="Company email" error={errors.comp_email} />
          <Input name="comp_mssgr" label="Company FB" error={errors.comp_mssgr} />
        </div>
        <Input name="marketing_src" label="How did you find out about Eve's Residences?" error={errors.marketing_src} />
      </SectionCard>

      {/* ---- Emergency contacts ---- */}
      <SectionCard title="Emergency contact 1 (required)">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input name="ec1_name" label="Name *" required error={errors.ec1_name} />
          <Input name="ec1_tel" label="Phone *" required error={errors.ec1_tel} />
          <Input name="ec1_email" label="Email" error={errors.ec1_email} />
          <Input name="ec1_mssgr" label="FB / Messenger" error={errors.ec1_mssgr} />
        </div>
      </SectionCard>

      <SectionCard title="Emergency contact 2 (optional)">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input name="ec2_name" label="Name" error={errors.ec2_name} />
          <Input name="ec2_tel" label="Phone" error={errors.ec2_tel} />
          <Input name="ec2_email" label="Email" error={errors.ec2_email} />
          <Input name="ec2_mssgr" label="FB / Messenger" error={errors.ec2_mssgr} />
        </div>
      </SectionCard>

      {/* ---- Lease terms ---- */}
      <SectionCard title="Lease terms">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input name="rate" type="number" min={0} step="0.01" label="Monthly rate (PHP) *" required error={errors.rate} />
          <Input name="occupancy_fee" type="number" min={0} step="0.01" label="Occupancy fee (PHP)" defaultValue="0" error={errors.occupancy_fee} />
          <Input name="advance" type="number" min={0} step="0.01" label="1 month advance (PHP)" error={errors.advance} />
          <Input name="sec_dep" type="number" min={0} step="0.01" label="Security deposit (PHP)" error={errors.sec_dep} />
          <Input name="utility_dep" type="number" min={0} step="0.01" label="Utility deposit (PHP)" error={errors.utility_dep} />
          <Input name="due_date" type="date" label="Rent due date" error={errors.due_date} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input name="rental_start" type="date" label="Rental start *" required error={errors.rental_start} />
          <Input name="rental_end" type="date" label="Rental end *" required error={errors.rental_end} />
          <Input name="rep" label="Property rep" error={errors.rep} />
        </div>

        {/* ---- Add-ons ---- */}
        <div className="space-y-3 rounded-xl border border-ink-100 bg-ink-50/40 p-4 dark:border-white/[0.04] dark:bg-white/[0.02]">
          <div>
            <label className="block text-sm font-medium text-ink-700">Add-ons</label>
            <p className="mt-0.5 text-xs text-ink-500">
              Check the items and enter the amount for each.
            </p>
          </div>

          {/* Preset rows — checkbox + label + amount */}
          <div className="space-y-2">
            {presets.map((p) => (
              <div
                key={p.label}
                className={
                  "flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors " +
                  (p.checked
                    ? "border-brand-500 bg-brand-500/5"
                    : "border-ink-200 bg-white dark:border-white/[0.06] dark:bg-white/[0.02]")
                }
              >
                <button
                  type="button"
                  onClick={() => togglePreset(p.label)}
                  className="flex flex-1 items-center gap-2 text-left text-sm"
                >
                  <span
                    className={
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded border " +
                      (p.checked
                        ? "border-brand-500 bg-brand-500 text-white"
                        : "border-ink-300 dark:border-white/[0.15]")
                    }
                  >
                    {p.checked && (
                      <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 8 7 12 13 4" />
                      </svg>
                    )}
                  </span>
                  <span className={p.checked ? "font-medium text-ink-900" : "text-ink-700"}>
                    {p.label}
                  </span>
                </button>

                <div className="relative w-32 shrink-0">
                  <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-ink-400">
                    ₱
                  </span>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={p.amount}
                    onChange={(e) => setPresetAmount(p.label, e.target.value)}
                    disabled={!p.checked}
                    placeholder="0.00"
                    className="pl-5 text-right tabular-nums disabled:opacity-50"
                  />
                </div>
              </div>
            ))}

            {/* Other row */}
            <div
              className={
                "flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors " +
                (otherEnabled
                  ? "border-brand-500 bg-brand-500/5"
                  : "border-ink-200 bg-white dark:border-white/[0.06] dark:bg-white/[0.02]")
              }
            >
              <button
                type="button"
                onClick={toggleOther}
                className="flex flex-1 items-center gap-2 text-left text-sm"
              >
                <span
                  className={
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded border " +
                    (otherEnabled
                      ? "border-brand-500 bg-brand-500 text-white"
                      : "border-ink-300 dark:border-white/[0.15]")
                  }
                >
                  {otherEnabled && (
                    <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 8 7 12 13 4" />
                    </svg>
                  )}
                </span>
                <span className={otherEnabled ? "font-medium text-ink-900" : "text-ink-700"}>
                  Other
                </span>
              </button>
              <div className="w-32 shrink-0" />
            </div>
          </div>

          {/* Custom rows — visible only when Other is checked */}
          {otherEnabled && (
            <div className="space-y-2 pl-4 pt-1">
              {customs.map((c, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    value={c.text}
                    onChange={(e) => updateCustom(idx, { text: e.target.value })}
                    placeholder={"Custom add-on #" + (idx + 1)}
                    className="flex-1"
                  />
                  <div className="relative w-32 shrink-0">
                    <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-ink-400">
                      ₱
                    </span>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={c.amount}
                      onChange={(e) => updateCustom(idx, { amount: e.target.value })}
                      placeholder="0.00"
                      className="pl-5 text-right tabular-nums"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeCustom(idx)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-ink-200 text-ink-500 transition-colors hover:border-danger-500 hover:text-danger-600 dark:border-white/[0.06]"
                    aria-label="Remove custom add-on"
                  >
                    ×
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={addCustom}
                className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
              >
                + Add another custom item
              </button>
            </div>
          )}
        </div>
      </SectionCard>

      {/* ---- Move-in checklist ---- */}
      <SectionCard title="Move-in checklist">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input name="num_per" type="number" min={1} label="Number of persons" error={errors.num_per} />
          <Input name="water" label="Water reading" error={errors.water} />
          <Input name="electric" label="Electric reading" error={errors.electric} />
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {INSPECTION_ITEMS.map((item) => (
            <div key={item.key} className="space-y-3 rounded-xl border border-ink-100 bg-ink-50/40 p-3 dark:border-white/[0.04] dark:bg-white/[0.02]">
              <Input
                name={item.key}
                label={item.label}
                placeholder="Condition (OK, damaged, etc.)"
              />
              <Input name={item.key + "_com"} label="Comment" placeholder="Notes" />
            </div>
          ))}
        </div>
      </SectionCard>

      {/* ---- Signature ---- */}
      <SectionCard title="Signature">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-ink-700">Sign below *</label>
            <button
              type="button"
              onClick={clearSignature}
              className="text-xs text-brand-600 hover:underline dark:text-brand-400"
            >
              Clear
            </button>
          </div>
          <canvas
            ref={signatureRef}
            width={800}
            height={150}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            className="block w-full rounded-xl border-2 border-dashed border-brand-500 bg-white touch-none"
            style={{ touchAction: "none" }}
          />
          {errors.signature && <p className="text-xs text-danger-600">{errors.signature}</p>}
        </div>
      </SectionCard>

      <div className="sticky bottom-0 -mx-4 border-t border-ink-200 bg-surface/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border dark:border-white/[0.06]">
        <Button type="submit" loading={pending} className="w-full">
          Submit intake form
        </Button>
      </div>
    </form>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4 rounded-2xl border border-ink-200 bg-white p-5 shadow-sm dark:border-white/[0.06] dark:bg-[#111318]">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-500">
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}