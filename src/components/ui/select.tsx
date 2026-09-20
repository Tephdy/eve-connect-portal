"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils/cn";

type Option = { value: string; label: string };

type Props = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
  options: Option[];
  placeholder?: string;
};

export const Select = forwardRef<HTMLSelectElement, Props>(function Select(
  { label, error, options, placeholder, className, id, ...rest },
  ref
) {
  const inputId = id ?? rest.name;
  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={inputId}
        className={cn(
          "w-full rounded border px-3 py-2 text-sm outline-none transition bg-white",
          "focus:ring-2 focus:ring-brand-500 focus:border-brand-500",
          error ? "border-red-400" : "border-gray-300",
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
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
});