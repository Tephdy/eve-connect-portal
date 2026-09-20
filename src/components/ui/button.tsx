"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
};

const VARIANTS: Record<Variant, string> = {
  primary:   "bg-brand-500 text-white hover:bg-brand-600 disabled:bg-brand-500/50",
  secondary: "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 disabled:opacity-50",
  ghost:     "text-gray-600 hover:bg-gray-100 disabled:opacity-50",
  danger:    "bg-red-600 text-white hover:bg-red-700 disabled:opacity-50",
};

const SIZES: Record<Size, string> = {
  sm: "text-xs px-2.5 py-1.5 rounded",
  md: "text-sm px-3.5 py-2 rounded",
  lg: "text-base px-5 py-2.5 rounded-md",
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
        "inline-flex items-center justify-center font-medium transition-colors disabled:cursor-not-allowed",
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...rest}
    >
      {loading && (
        <svg className="animate-spin -ml-0.5 mr-2 h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      )}
      {children}
    </button>
  );
});