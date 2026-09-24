"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { uploadReceiptAction, type UploadResult } from "@/app/(dashboard)/property/receipts/actions";
import type { ActionResult } from "@/lib/actions/result";
import type { Tenant } from "@/lib/db/tenants";

const PAYMENT_TYPES = [
  { value: "rent", label: "Rent" },
  { value: "utility", label: "Utility" },
  { value: "deposits", label: "Deposits" },
  { value: "overdue", label: "Overdue" },
  { value: "add-ons", label: "Add-ons" },
  { value: "all", label: "All" },
  { value: "others", label: "Others" },
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      <Upload className="mr-1.5 h-3.5 w-3.5" />
      Upload to Google Drive
    </Button>
  );
}

export function ReceiptUploadForm({ tenants }: { tenants: Tenant[] }) {
  const router = useRouter();
  const toast = useToast();
  const [state, formAction] = useActionState<ActionResult<UploadResult> | null, FormData>(
    uploadReceiptAction,
    null
  );

  const [paymentFor, setPaymentFor] = useState<string[]>(["rent"]);
  const [customLabel, setCustomLabel] = useState("");
  const [fileNames, setFileNames] = useState<string[]>([]);

  useEffect(() => {
    if (state?.ok) {
      toast.push(
        "Uploaded " + state.data.fileCount + " file(s) to " + state.data.folderName,
        "success"
      );
      const t = setTimeout(() => router.push("/property/receipts"), 800);
      return () => clearTimeout(t);
    } else if (state && !state.ok) {
      toast.push(state.error, "error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function toggle(value: string) {
    setPaymentFor((prev) => {
      if (value === "all") return prev.includes("all") ? [] : ["all"];
      const next = prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev.filter((v) => v !== "all"), value];
      return next;
    });
  }

  const tenantOptions = tenants.map((t) => ({
    value: t.id,
    label: t.full_name + (t.phone ? " - " + t.phone : ""),
  }));

  const needsCustomLabel = paymentFor.includes("others");

  return (
    <Card className="max-w-3xl">
      <CardBody>
        <form action={formAction} className="space-y-5">
          <Select
            name="tenant_id"
            label="Tenant"
            options={tenantOptions}
            placeholder="Select a tenant"
            error={state && !state.ok ? state.fieldErrors?.tenant_id : undefined}
            required
          />

          <Input
            name="payment_month"
            type="month"
            label="Payment for the month of"
            defaultValue={new Date().toISOString().slice(0, 7)}
            required
          />

          <div>
            <label className="mb-2 block text-sm font-medium text-ink-700">
              Payment for
            </label>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_TYPES.map((p) => {
                const active = paymentFor.includes(p.value);
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => toggle(p.value)}
                    className={
                      "rounded-lg border px-3 py-1.5 text-sm font-medium transition-all " +
                      (active
                        ? "border-brand-500 bg-brand-500 text-white shadow-sm"
                        : "border-ink-200 bg-white/70 text-ink-700 hover:border-brand-300 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-ink-200")
                    }
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
            {paymentFor.map((t) => (
              <input key={t} type="hidden" name="payment_for" value={t} />
            ))}
            {needsCustomLabel && (
              <div className="mt-3">
                <Input
                  label="Custom label"
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  placeholder="e.g., Parking fee"
                />
                <input type="hidden" name="custom_label" value={customLabel} />
              </div>
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-ink-700">
              Files (images or PDF, max 10 MB each)
            </label>
            <input
              type="file"
              name="files"
              multiple
              accept="image/*,application/pdf"
              onChange={(e) => {
                const arr = Array.from(e.target.files ?? []);
                setFileNames(arr.map((f) => f.name + " (" + Math.round(f.size / 1024) + " KB)"));
              }}
              className="block w-full rounded-lg border border-white/60 bg-white/70 px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-500 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-brand-600 dark:border-white/[0.08] dark:bg-white/[0.04]"
            />
            {fileNames.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-ink-500">
                {fileNames.map((n, i) => (<li key={i}>{n}</li>))}
              </ul>
            )}
          </div>

          <Input
            name="notes"
            label="Notes (optional)"
            placeholder="Anything accounting should know about these receipts"
          />

          <div className="flex items-center gap-3 pt-2">
            <SubmitButton />
            <Button type="button" variant="secondary" onClick={() => router.push("/property/receipts")}>
              Cancel
            </Button>
          </div>

          {state && !state.ok && (
            <p className="text-xs text-red-600">{state.error}</p>
          )}
        </form>
      </CardBody>
    </Card>
  );
}
