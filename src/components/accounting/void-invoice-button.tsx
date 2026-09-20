"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { voidInvoiceAction } from "@/app/(dashboard)/accounting/invoices/actions";

export function VoidInvoiceButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const toast = useToast();

  function onClick() {
    if (!confirming) { setConfirming(true); return; }
    start(async () => {
      try {
        await voidInvoiceAction(id);
        toast.push("Invoice voided", "success");
      } catch { toast.push("Failed to void", "error"); }
    });
  }

  return (
    <Button variant={confirming ? "danger" : "secondary"} onClick={onClick} loading={pending}>
      {confirming ? "Click again to void" : "Void Invoice"}
    </Button>
  );
}
