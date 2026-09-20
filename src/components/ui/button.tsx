"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "secondary" | "subtle" | "ghost" | "danger";
type Size = "sm" | "md" | "lg" | "icon";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
};

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand-500 text-white hover:bg-brand-600 active:bg-brand-700 disabled:bg-brand-500/50 shadow-xs",
  secondary:
    "bg-surface text-ink-700 border border-ink-200 hover:bg-ink-50 active:bg-ink-100 disabled:opacity-50 shadow-xs",
  subtle:
    "bg-ink-100 text-ink-800 hover:bg-ink-200 active:bg-ink-300 disabled:opacity-50",
  ghost:
    "text-ink-600 hover:bg-ink-100 active:bg-ink-200 disabled:opacity-50",
  danger:
    "bg-danger-500 text-white hover:bg-danger-700 active:bg-danger-700 disabled:opacity-50 shadow-xs",
};

const SIZES: Record<Size, string> = {
  sm: "text-xs h-8 px-3 gap-1.5 rounded-md",
  md: "text-sm h-9 px-3.5 gap-2 rounded-md",
  lg: "text-sm h-10 px-4 gap-2 rounded-md",
  icon: "h-9 w-9 rounded-md",
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "primary", size = "md", loading, disabled, className, children, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center font-medium transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1",
        "disabled:cursor-not-allowed select-none",
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...rest}
    >
      {loading && (
        <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      )}
      {children}
    </button>
  );
});
