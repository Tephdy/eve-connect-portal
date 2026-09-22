"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { X, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type Toast = {
  id: number;
  message: string;
  tone: "success" | "error" | "info";
};

type Ctx = {
  push: (message: string, tone?: Toast["tone"]) => void;
};

const ToastContext = createContext<Ctx | null>(null);

const TONES = {
  success: {
    wrap: "bg-emerald-500/95 text-white",
    icon: CheckCircle2,
  },
  error: {
    wrap: "bg-rose-500/95 text-white",
    icon: AlertCircle,
  },
  info: {
    wrap: "bg-ink-900/95 text-white dark:bg-ink-800/95",
    icon: Info,
  },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const push = useCallback(
    (message: string, tone: Toast["tone"] = "info") => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t, { id, message, tone }]);
      setTimeout(() => remove(id), 4000);
    },
    [remove]
  );

  return (
    <ToastContext.Provider value={{ push }}>
      {children}

      <div className="pointer-events-none fixed inset-x-0 top-6 z-[100] flex flex-col items-center gap-3 px-4">
        {toasts.map((t) => {
          const { wrap, icon: Icon } = TONES[t.tone];
          return (
            <div
              key={t.id}
              role="status"
              className={cn(
                "pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border border-white/20 px-5 py-3.5 shadow-2xl backdrop-blur-md",
                "animate-in slide-in-from-top-2 fade-in duration-200",
                wrap
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <p className="flex-1 text-sm font-medium leading-snug">{t.message}</p>
              <button
                onClick={() => remove(t.id)}
                className="shrink-0 rounded p-1 transition-colors hover:bg-white/10"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
