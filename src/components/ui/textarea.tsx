"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils/cn";

type Props = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  error?: string;
  hint?: string;
};

export const Textarea = forwardRef<HTMLTextAreaElement, Props>(function Textarea(
  { label, error, hint, className, id, ...rest },
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
      <textarea
        ref={ref}
        id={inputId}
        className={cn(
          "w-full rounded-xl border bg-white/60 dark:bg-white/[0.04] backdrop-blur-sm px-3 py-2 text-sm text-ink-900 dark:text-ink-100",
          "placeholder:text-ink-400 font-mono",
          "transition-all duration-150 outline-none",
          "focus:border-brand-500 focus:bg-white/90 dark:focus:bg-white/[0.08] focus:ring-4 focus:ring-brand-500/15",
          "disabled:cursor-not-allowed disabled:bg-ink-50/60 disabled:text-ink-500",
          error
            ? "border-danger-500 focus:border-danger-500 focus:ring-danger-500/20"
            : "border-white/60 dark:border-white/[0.08]",
          className
        )}
        {...rest}
      />
      {hint && !error && <p className="text-xs text-ink-500">{hint}</p>}
      {error && <p className="text-xs text-danger-700">{error}</p>}
    </div>
  );
});
