"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { verifyReservationAction } from "@/app/(dashboard)/accounting/reservations/actions";
import type { UnitReservation } from "@/lib/db/unit-reservations";

export function VerifyPanel({ reservation }: { reservation: UnitReservation }) {
  const [pending, start] = useTransition();
  const [orRef, setOrRef] = useState(reservation.or_reference ?? "");
  const [notes, setNotes] = useState(reservation.verification_notes ?? "");
  const toast = useToast();

  const isVerified = reservation.verification_status === "verified";
  const isDiscrepancy = reservation.verification_status === "discrepancy";

  function submit(status: "verified" | "discrepancy") {
    start(async () => {
      const r = await verifyReservationAction(
        reservation.id,
        status,
        orRef.trim() || null,
        notes.trim() || null
      );
      if (!r.ok) {
        toast.push(r.error, "error");
        return;
      }
      toast.push(
        status === "verified" ? "Reservation verified" : "Marked as discrepancy",
        "success"
      );
    });
  }

  return (
    <div className="rounded-2xl border border-white/40 bg-white/60 p-5 backdrop-blur-sm dark:border-white/[0.06] dark:bg-white/[0.02]">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-ink-500">
        Verification
      </h2>

      {reservation.verification_status !== "pending" && (
        <div
          className={
            "mb-4 rounded-xl p-3 " +
            (isVerified
              ? "border border-emerald-500/30 bg-emerald-500/10"
              : "border border-rose-500/30 bg-rose-500/10")
          }
        >
          <div className="flex items-center gap-2">
            {isVerified ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-rose-600" />
            )}
            <span className="text-sm font-semibold capitalize">
              {reservation.verification_status}
            </span>
            {reservation.verified_at && (
              <span className="text-xs text-ink-500">
                · {new Date(reservation.verified_at).toLocaleString("en-PH")}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <Input
          label="OR reference (official receipt)"
          value={orRef}
          onChange={(e) => setOrRef(e.target.value)}
          placeholder="OR number from the property rep"
        />

        <div>
          <label className="mb-1 block text-xs font-semibold text-ink-500">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="e.g., Receipt amount matches. OR received via email."
            className="w-full rounded-lg border border-white/60 bg-white/70 px-3 py-2 text-sm dark:border-white/[0.08] dark:bg-white/[0.04]"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            onClick={() => submit("verified")}
            loading={pending}
            className="flex-1"
          >
            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
            Mark verified
          </Button>
          <Button
            variant="secondary"
            onClick={() => submit("discrepancy")}
            loading={pending}
            className="flex-1"
          >
            <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />
            Mark discrepancy
          </Button>
        </div>
      </div>
    </div>
  );
}
