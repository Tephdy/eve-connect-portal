"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { createTenantAction, updateTenantAction } from "@/app/(dashboard)/property/tenants/actions";
import type { ActionResult } from "@/lib/actions/result";
import type { Tenant } from "@/lib/db/tenants";
import type { ReservationRow } from "@/lib/db/unit-reservations";

const STATUS_OPTIONS = [
  { value: "prospect",    label: "Prospect" },
  { value: "active",      label: "Active" },
  { value: "former",      label: "Former" },
  { value: "blacklisted", label: "Blacklisted" },
];

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" loading={pending}>{label}</Button>;
}

export function TenantForm({
  mode,
  tenant,
  reservations,
}: {
  mode: "create" | "edit";
  tenant?: Tenant;
  reservations?: ReservationRow[];
}) {
  const router = useRouter();
  const toast = useToast();
  const action = mode === "create" ? createTenantAction : updateTenantAction.bind(null, tenant!.id);
  const [state, formAction] = useActionState<ActionResult | null, FormData>(action, null);

  const [reservationId, setReservationId] = useState<string>("");
  const [fullName, setFullName] = useState(tenant?.full_name ?? "");
  const [email, setEmail] = useState(tenant?.email ?? "");
  const [phone, setPhone] = useState(tenant?.phone ?? "");
  const [messengerName, setMessengerName] = useState(tenant?.messenger_name ?? "");
  const [governmentId, setGovernmentId] = useState(tenant?.government_id ?? "");

  function applyReservation(id: string) {
    setReservationId(id);
    if (!id || !reservations) return;
    const r = reservations.find((x) => x.id === id);
    if (!r) return;
    setFullName(r.client_name ?? "");
    setPhone(r.client_phone ?? "");
    setEmail(r.client_email ?? "");
    // Pull inquiry details if the reservation was linked to an inquiry
    const anyR = r as any;
    setMessengerName(anyR.inquiry_messenger_name ?? "");
    setGovernmentId(anyR.inquiry_government_id ?? "");
  }

  useEffect(() => {
    if (state?.ok) {
      toast.push(mode === "create" ? "Tenant created" : "Tenant updated", "success");
    } else if (state && !state.ok) {
      toast.push(state.error, "error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const fieldError = (k: string) => (state && !state.ok ? state.fieldErrors?.[k] : undefined);

  return (
    <Card className="max-w-2xl">
      <CardBody>
        <form action={formAction} className="space-y-4">
          {mode === "create" && reservations && reservations.length > 0 && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-500">
                From reservation (optional)
              </label>
              <select
                value={reservationId}
                onChange={(e) => applyReservation(e.target.value)}
                className="w-full rounded-lg border border-white/60 bg-white/70 px-3 py-1.5 text-sm dark:border-white/[0.08] dark:bg-white/[0.04]"
              >
                <option value="">— Select a reservation —</option>
                {reservations.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.client_name}
                    {r.unit_number ? " · Unit " + r.unit_number : ""}
                    {r.property_name ? " · " + r.property_name : ""}

                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-ink-500">
                Selecting a reservation will fill in the tenant details below.
              </p>
            </div>
          )}
          {reservationId && (
            <input type="hidden" name="from_reservation_id" value={reservationId} />
          )}
          <Input
            name="full_name"
            label="Full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            error={fieldError("full_name")}
            required
          />
          <Input
            name="email"
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fieldError("email")}
          />
          <Input
            name="phone"
            label="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            error={fieldError("phone")}
          />
          <Input
            name="messenger_name"
            label="Messenger name"
            hint="e.g. Facebook / Messenger account name"
            value={messengerName}
            onChange={(e) => setMessengerName(e.target.value)}
            error={fieldError("messenger_name")}
          />
          <Input
            name="government_id"
            label="Government ID"
            value={governmentId}
            onChange={(e) => setGovernmentId(e.target.value)}
            error={fieldError("government_id")}
            hint="Stored securely; used for contracts."
          />
          <Select name="status" label="Status" options={STATUS_OPTIONS} defaultValue={tenant?.status ?? "prospect"} error={fieldError("status")} />
          <div className="flex items-center gap-3 pt-2">
            <SubmitButton label={mode === "create" ? "Create Tenant" : "Save Changes"} />
            <Button type="button" variant="secondary" onClick={() => router.push("/property/tenants")}>
              Cancel
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
