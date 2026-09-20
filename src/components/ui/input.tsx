"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils/cn";

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  hint?: string;
  leadingIcon?: React.ReactNode;
};

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, error, hint, leadingIcon, className, id, ...rest },
  ref
) {
  const inputId = id ?? rest.name;
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-ink-700">
          {label}
        </label>
      )}
      <div className="relative">
        {leadingIcon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400">
            {leadingIcon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "h-9 w-full rounded-md border bg-surface px-3 text-sm text-ink-900",
            "placeholder:text-ink-400",
            "transition-colors outline-none",
            "focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20",
            "disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-ink-500",
            error ? "border-danger-500 focus:border-danger-500 focus:ring-danger-500/20" : "border-ink-200",
            leadingIcon && "pl-9",
            className
          )}
          {...rest}
        />
      </div>
      {hint && !error && <p className="text-xs text-ink-500">{hint}</p>}
      {error && <p className="text-xs text-danger-700">{error}</p>}
    </div>
  );
});
