import { AlertCircle, CheckCircle2, Info, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type Variant = "info" | "success" | "warning" | "danger";

const VARIANTS: Record<Variant, { wrap: string; icon: React.ReactNode }> = {
  info: {
    wrap: "border-sky-500/20 bg-sky-500/10 text-sky-900 dark:text-sky-100",
    icon: <Info className="h-4 w-4 shrink-0" />,
  },
  success: {
    wrap: "border-emerald-500/20 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100",
    icon: <CheckCircle2 className="h-4 w-4 shrink-0" />,
  },
  warning: {
    wrap: "border-amber-500/20 bg-amber-500/15 text-amber-900 dark:text-amber-100",
    icon: <AlertTriangle className="h-4 w-4 shrink-0" />,
  },
  danger: {
    wrap: "border-rose-500/20 bg-rose-500/10 text-rose-900 dark:text-rose-100",
    icon: <AlertCircle className="h-4 w-4 shrink-0" />,
  },
};

export function Alert({
  variant = "info",
  title,
  children,
  className,
}: {
  variant?: Variant;
  title?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const v = VARIANTS[variant];
  return (
    <div className={cn("flex items-start gap-2.5 rounded-xl border backdrop-blur-sm px-4 py-3 text-sm", v.wrap, className)}>
      {v.icon}
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && "mt-0.5", "text-current/90")}>{children}</div>}
      </div>
    </div>
  );
}
