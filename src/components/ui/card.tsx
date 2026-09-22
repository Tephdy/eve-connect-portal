import { cn } from "@/lib/utils/cn";

export function Card({
  children,
  className,
  interactive,
  gradient,
  variant = "glass",
}: {
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
  gradient?: boolean;
  variant?: "glass" | "solid" | "plain";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl",
        variant === "glass" && "glass",
        variant === "solid" &&
          "border border-ink-200/70 bg-surface shadow-sm dark:border-white/[0.06]",
        variant === "plain" && "border border-ink-200/60 dark:border-white/[0.06]",
        interactive &&
          "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg cursor-pointer",
        gradient &&
          "bg-gradient-to-br from-brand-500/10 to-accent-500/10 backdrop-blur-xl",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 border-b border-white/40 px-6 py-5 dark:border-white/[0.06]",
        className
      )}
    >
      <div className="min-w-0">
        <h3 className="text-base font-semibold tracking-tight text-ink-900">
          {title}
        </h3>
        {description && <p className="mt-0.5 text-sm text-ink-500">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("p-6", className)}>{children}</div>;
}

export function CardFooter({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-2 border-t border-white/40 px-6 py-4 dark:border-white/[0.06]",
        className
      )}
    >
      {children}
    </div>
  );
}
