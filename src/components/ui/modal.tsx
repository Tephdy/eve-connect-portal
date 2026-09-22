"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useDismissable } from "@/lib/hooks/use-dismissable";

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const ref = useDismissable({
    active: open,
    onDismiss: onClose,
    lockScroll: true,
  });

  if (!open) return null;

  const widths = {
    sm: "max-w-sm",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-900/30 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={ref}
        className={cn(
          "glass-strong mt-16 w-full rounded-2xl shadow-2xl",
          widths[size]
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/40 px-6 py-4 dark:border-white/[0.06]">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-ink-900">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-ink-500">{description}</p>}
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-ink-400 transition-colors hover:bg-white/60 hover:text-ink-700 dark:hover:bg-white/[0.08]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
