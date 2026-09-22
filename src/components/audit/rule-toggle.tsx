"use client";

import { useTransition } from "react";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/components/ui/toast";
import { updateRuleAction } from "@/app/(dashboard)/accounting/audit/actions";

export function RuleToggle({ ruleKey, enabled }: { ruleKey: string; enabled: boolean }) {
  const [pending, start] = useTransition();
  const toast = useToast();

  function toggle() {
    start(async () => {
      const result = await updateRuleAction(ruleKey, { enabled: !enabled });
      if (!result.ok) {
        toast.push(result.error, "error");
        return;
      }
      toast.push(enabled ? "Rule disabled" : "Rule enabled", "success");
    });
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors disabled:opacity-50",
        enabled ? "bg-brand-gradient" : "bg-ink-300 dark:bg-white/[0.10]"
      )}
      aria-label={enabled ? "Disable rule" : "Enable rule"}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform",
          enabled ? "translate-x-5" : "translate-x-0"
        )}
      />
    </button>
  );
}
