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
    "bg-brand-gradient text-white shadow-md shadow-brand-500/30 hover:shadow-lg hover:shadow-brand-500/40 active:scale-[0.98] disabled:opacity-50 disabled:shadow-none",
  secondary:
    "bg-white/60 dark:bg-white/[0.06] backdrop-blur-sm text-ink-700 dark:text-ink-200 border border-white/60 dark:border-white/[0.08] shadow-sm hover:bg-white/90 dark:hover:bg-white/[0.10] active:scale-[0.98] disabled:opacity-50",
  subtle:
    "bg-ink-100/70 dark:bg-white/[0.05] text-ink-800 dark:text-ink-200 hover:bg-ink-200/70 dark:hover:bg-white/[0.08] active:scale-[0.98] disabled:opacity-50",
  ghost:
    "text-ink-600 hover:bg-white/60 dark:hover:bg-white/[0.06] active:scale-[0.98] disabled:opacity-50",
  danger:
    "bg-rose-500 text-white shadow-md shadow-rose-500/30 hover:bg-rose-600 hover:shadow-lg hover:shadow-rose-500/40 active:scale-[0.98] disabled:opacity-50",
};

const SIZES: Record<Size, string> = {
  sm: "text-xs h-8 px-3 gap-1.5 rounded-lg",
  md: "text-sm h-9 px-3.5 gap-2 rounded-xl",
  lg: "text-sm h-10 px-4 gap-2 rounded-xl",
  icon: "h-9 w-9 rounded-xl",
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
        "inline-flex items-center justify-center font-medium transition-all duration-150",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
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
