"use client";

import { Building2, DoorOpen, Users, FileText } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { TARGETS } from "@/lib/import/field-defs";
import type { TargetTable } from "@/lib/import/types";

const ICONS: Record<TargetTable, React.ComponentType<{ className?: string }>> = {
  properties: Building2,
  units: DoorOpen,
  tenants: Users,
  leases: FileText,
};

export function TargetPicker({
  value,
  onChange,
}: {
  value: TargetTable | null;
  onChange: (v: TargetTable) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {TARGETS.map((t) => {
        const Icon = ICONS[t.key];
        const active = value === t.key;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={cn(
              "flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors",
              active
                ? "border-brand-500 bg-brand-500/5"
                : "border-ink-200 bg-surface hover:border-ink-300 dark:border-white/[0.06] dark:hover:border-white/[0.12]"
            )}
          >
            <div
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg",
                active
                  ? "bg-brand-500 text-white"
                  : "bg-brand-500/10 text-brand-600 dark:text-brand-400"
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink-900">{t.label}</p>
              <p className="mt-0.5 text-xs text-ink-500">{t.description}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
