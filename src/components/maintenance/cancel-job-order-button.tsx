"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cancelJobOrderAction } from "@/app/(dashboard)/maintenance/actions";

export function CancelJobOrderButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const toast = useToast();

  function onClick() {
    if (!confirming) { setConfirming(true); return; }
    start(async () => {
      try {
        await cancelJobOrderAction(id);
        toast.push("Job order cancelled", "success");
      } catch {
        toast.push("Failed to cancel", "error");
      }
    });
  }

  return (
    <Button
      variant={confirming ? "danger" : "secondary"}
      onClick={onClick}
      loading={pending}
    >
      {confirming ? "Click again to cancel" : "Cancel job order"}
    </Button>
  );
}