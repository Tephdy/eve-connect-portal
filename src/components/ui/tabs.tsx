"use client";

import { cn } from "@/lib/utils/cn";

export type TabItem<T extends string = string> = {
  value: T;
  label: string;
  badge?: React.ReactNode;
};

export function Tabs<T extends string = string>({
  items,
  value,
  onChange,
  className,
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1 border-b border-white/40 dark:border-white/[0.06]", className)}>
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            onClick={() => onChange(item.value)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-all",
              active
                ? "border-brand-500 text-brand-600 dark:text-brand-400"
                : "border-transparent text-ink-500 hover:text-ink-800"
            )}
          >
            <span className="inline-flex items-center gap-2">
              {item.label}
              {item.badge}
            </span>
          </button>
        );
      })}
    </div>
  );
}
