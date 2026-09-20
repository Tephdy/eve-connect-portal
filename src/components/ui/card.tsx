import { cn } from "@/lib/utils/cn";

export function Card({
  children,
  className,
  interactive,
  gradient,
}: {
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
  gradient?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-ink-200/70 bg-surface shadow-sm",
        "dark:border-white/[0.06] dark:bg-surface",
        interactive && "transition-all hover:border-brand-300/60 hover:shadow-md dark:hover:border-brand-500/30",
        gradient && "bg-gradient-to-br from-brand-500/10 to-accent-500/10 dark:from-brand-500/15 dark:to-accent-500/15",
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
    <div className={cn("flex items-start justify-between gap-4 border-b border-ink-200/60 px-6 py-5 dark:border-white/[0.06]", className)}>
      <div className="min-w-0">
        <h3 className="text-base font-semibold text-ink-900">{title}</h3>
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
    <div className={cn("flex items-center justify-end gap-2 border-t border-ink-200/60 px-6 py-4 dark:border-white/[0.06]", className)}>
      {children}
    </div>
  );
}
