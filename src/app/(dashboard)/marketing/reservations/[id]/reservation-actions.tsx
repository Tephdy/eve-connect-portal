"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  regenerateReservationContractAction,
  deleteReservationAction,
} from "../actions";

export function ReservationActions({
  reservationId,
  contractId,
  contractStatus,
  mode,
}: {
  reservationId: string;
  contractId: string | null;
  contractStatus: string | null;
  mode: "generate" | "manage";
}) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  function regenerate() {
    start(async () => {
      const r = await regenerateReservationContractAction(reservationId);
      if (r.ok) {
        toast.push("Contract regenerated", "success");
        router.refresh();
      } else {
        toast.push(r.error, "error");
      }
    });
  }

  function del() {
    if (!confirm("Delete this reservation? This cannot be undone.")) return;
    start(async () => {
      const r = await deleteReservationAction(reservationId);
      if (r.ok) {
        toast.push("Reservation deleted", "success");
        router.push("/marketing/reservations");
      } else {
        toast.push(r.error, "error");
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" onClick={regenerate} loading={pending}>
        {mode === "generate" ? "Generate contract" : "Regenerate"}
      </Button>
      {mode === "manage" && (
        <Button size="sm" variant="secondary" onClick={del} loading={pending}>
          Delete reservation
        </Button>
      )}
    </div>
  );
}
