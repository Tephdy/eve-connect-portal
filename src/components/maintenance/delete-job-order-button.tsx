"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { deleteJobOrderAction } from "@/app/(dashboard)/maintenance/actions";

export function DeleteJobOrderButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const toast = useToast();

  function onClick() {
    if (!confirming) { setConfirming(true); return; }
    start(async () => {
      try {
        await deleteJobOrderAction(id);
      } catch {
        toast.push("Failed to delete", "error");
      }
    });
  }

  return (
    <Button
      variant="danger"
      onClick={onClick}
      loading={pending}
    >
      {confirming ? "Click again to DELETE" : "Delete permanently"}
    </Button>
  );
}