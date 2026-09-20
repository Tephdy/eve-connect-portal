import { AlertCircle, CheckCircle2, Info, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type Variant = "info" | "success" | "warning" | "danger";

const VARIANTS: Record<Variant, { wrap: string; icon: React.ReactNode }> = {
  info: {
    wrap: "border-info-500/30 bg-info-50 text-info-700",
    icon: <Info className="h-4 w-4 shrink-0" />,
  },
  success: {
    wrap: "border-success-500/30 bg-success-50 text-success-700",
    icon: <CheckCircle2 className="h-4 w-4 shrink-0" />,
  },
  warning: {
    wrap: "border-warning-500/30 bg-warning-50 text-warning-700",
    icon: <AlertTriangle className="h-4 w-4 shrink-0" />,
  },
  danger: {
    wrap: "border-danger-500/30 bg-danger-50 text-danger-700",
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
    <div className={cn("flex items-start gap-2.5 rounded-md border px-3.5 py-2.5 text-sm", v.wrap, className)}>
      {v.icon}
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn(title && "mt-0.5", "text-current/90")}>{children}</div>}
      </div>
    </div>
  );
}
