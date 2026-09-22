"use client";

import { useTransition } from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { generateBillsAction } from "@/app/(dashboard)/property/utilities/billing/actions";

export function GenerateBillsButton({ month }: { month: string }) {
  const [pending, start] = useTransition();
  const toast = useToast();

  function go() {
    start(async () => {
      const r = await generateBillsAction(month);
      if (!r.ok) {
        toast.push(r.error, "error");
        return;
      }
      const { created, skipped, errors } = r.data;
      const msg = created + " invoice(s) created, " + skipped + " skipped" +
        (errors.length > 0 ? ", " + errors.length + " error(s)" : "");
      toast.push(msg, created > 0 ? "success" : "error");
    });
  }

  return (
    <Button onClick={go} loading={pending}>
      {!pending && <FileText className="mr-1.5 h-3.5 w-3.5" />}
      Generate invoices for {month}
    </Button>
  );
}
