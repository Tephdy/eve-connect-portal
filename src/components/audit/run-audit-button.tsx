"use client";

import { useTransition } from "react";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { runAuditAction } from "@/app/(dashboard)/accounting/audit/actions";

export function RunAuditButton() {
  const [pending, start] = useTransition();
  const toast = useToast();

  function onClick() {
    start(async () => {
      const result = await runAuditAction();
      if (!result.ok) {
        toast.push(result.error, "error");
        return;
      }
      const d = result.data;
      toast.push(
        "Audit complete - " + d.violations_found + " violations, " + d.new_findings + " new, " + d.auto_closed + " auto-closed",
        "success"
      );
    });
  }

  return (
    <Button onClick={onClick} loading={pending}>
      {!pending && <Play className="mr-1.5 h-3.5 w-3.5" />}
      Run audit
    </Button>
  );
}
