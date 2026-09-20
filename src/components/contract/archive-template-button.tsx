"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { archiveTemplateAction } from "@/app/(dashboard)/property/templates/actions";

export function ArchiveTemplateButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const toast = useToast();

  function onClick() {
    if (!confirming) { setConfirming(true); return; }
    start(async () => {
      try { await archiveTemplateAction(id); }
      catch { toast.push("Failed to archive", "error"); }
    });
  }

  return (
    <Button variant={confirming ? "danger" : "secondary"} onClick={onClick} loading={pending}>
      {confirming ? "Click again to confirm" : "Archive"}
    </Button>
  );
}
