"use client";

import { useTransition } from "react";
import { Loader2, Table2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/components/ui/toast";
import { parseSheetByNameAction } from "@/app/(dashboard)/property/import/actions";
import type { ParsedSheet } from "@/lib/import/types";

export function SheetPicker({
  filename,
  sheetNames,
  activeSheet,
  onSwitch,
}: {
  filename: string;
  sheetNames: string[];
  activeSheet?: string;
  onSwitch: (sheet: ParsedSheet) => void;
}) {
  const [pending, start] = useTransition();
  const toast = useToast();

  function handleSwitch(name: string) {
    if (name === activeSheet) return;
    start(async () => {
      const result = await parseSheetByNameAction({
        filename,
        sheet_name: name,
      });
      if (result.ok) {
        onSwitch(result.data);
        toast.push("Loaded sheet: " + name, "success");
      } else {
        toast.push(result.error, "error");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-ink-200 bg-surface p-2 dark:border-white/[0.06]">
      <div className="flex items-center gap-1.5 px-2 text-xs font-medium text-ink-500">
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Table2 className="h-3.5 w-3.5" />
        )}
        Sheet
      </div>
      {sheetNames.map((name) => {
        const active = name === activeSheet;
        return (
          <button
            key={name}
            onClick={() => handleSwitch(name)}
            disabled={pending}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-brand-500 text-white shadow-sm"
                : "text-ink-600 hover:bg-ink-100 dark:hover:bg-white/[0.05]",
              pending && "opacity-60 cursor-not-allowed"
            )}
          >
            {name}
          </button>
        );
      })}
    </div>
  );
}
