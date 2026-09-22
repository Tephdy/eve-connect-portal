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
        <label htmlFor={inputId} className="block text-sm font-medium text-ink-700 dark:text-ink-300">
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
            "h-10 w-full rounded-xl border bg-white/60 dark:bg-white/[0.04] backdrop-blur-sm px-3 text-sm text-ink-900 dark:text-ink-100",
            "placeholder:text-ink-400",
            "transition-all duration-150 outline-none",
            "focus:border-brand-500 focus:bg-white/90 dark:focus:bg-white/[0.08] focus:ring-4 focus:ring-brand-500/15",
            "disabled:cursor-not-allowed disabled:bg-ink-50/60 disabled:text-ink-500",
            error
              ? "border-danger-500 focus:border-danger-500 focus:ring-danger-500/20"
              : "border-white/60 dark:border-white/[0.08]",
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
