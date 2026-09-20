"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { terminateLeaseAction } from "@/app/(dashboard)/property/leases/actions";

export function TerminateLeaseButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const toast = useToast();

  function onClick() {
    if (!confirming) { setConfirming(true); return; }
    start(async () => {
      try {
        await terminateLeaseAction(id);
      } catch {
        toast.push("Failed to terminate lease", "error");
      }
    });
  }

  return (
    <Button variant={confirming ? "danger" : "secondary"} onClick={onClick} loading={pending}>
      {confirming ? "Click again to confirm" : "Terminate"}
    </Button>
  );
}
