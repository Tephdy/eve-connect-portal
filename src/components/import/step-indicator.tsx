import { Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { ImportStep } from "@/lib/import/types";

const STEPS: { key: ImportStep; label: string }[] = [
  { key: "source", label: "Upload" },
  { key: "map", label: "Map columns" },
  { key: "review", label: "Review" },
  { key: "done", label: "Done" },
];

export function StepIndicator({ current }: { current: ImportStep }) {
  const currentIdx = STEPS.findIndex((s) => s.key === current);

  return (
    <div className="flex items-center gap-2">
      {STEPS.map((step, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <div key={step.key} className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                done && "bg-success-500 text-white",
                active && "bg-brand-500 text-white",
                !done && !active && "bg-ink-100 text-ink-500 dark:bg-white/[0.06]"
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span
              className={cn(
                "text-sm font-medium",
                active ? "text-ink-900" : done ? "text-ink-700" : "text-ink-400"
              )}
            >
              {step.label}
            </span>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "h-px w-8",
                  i < currentIdx ? "bg-success-500" : "bg-ink-200 dark:bg-white/[0.08]"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
