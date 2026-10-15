"use client";

import { forwardRef } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type Option = { value: string; label: string };

type Props = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
  hint?: string;
  options: Option[];
  placeholder?: string;
};

export const Select = forwardRef<HTMLSelectElement, Props>(function Select(
  { label, error, hint, options, placeholder, className, id, ...rest },
  ref
) {
  const inputId = id ?? rest.name;
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-ink-700 dark:text-ink-300">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={inputId}
          className={cn(
            "h-10 w-full appearance-none rounded-xl border bg-white/60 dark:bg-white/[0.04] backdrop-blur-sm px-3 pr-9 text-sm text-ink-900 dark:text-ink-100",
            "transition-all duration-150 outline-none cursor-pointer",
            "focus:border-brand-500 focus:bg-white/90 dark:focus:bg-white/[0.08] focus:ring-4 focus:ring-brand-500/15",
            "disabled:cursor-not-allowed disabled:bg-ink-50/60 disabled:text-ink-500",
            error ? "border-danger-500" : "border-white/60 dark:border-white/[0.08]",
            className
          )}
          {...rest}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
      </div>
      {hint && !error && <p className="text-xs text-ink-500">{hint}</p>}
      {error && <p className="text-xs text-danger-700">{error}</p>}
    </div>
  );
});
