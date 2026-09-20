import { cn } from "@/lib/utils/cn";

export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="border-b border-ink-200/60 dark:border-white/[0.06]">
      {children}
    </thead>
  );
}

export function TBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-ink-100 dark:divide-white/[0.04]">{children}</tbody>;
}

export function TR({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <tr className={cn("transition-colors hover:bg-ink-50/60 dark:hover:bg-white/[0.02]", className)}>
      {children}
    </tr>
  );
}

export function TH({
  children,
  className,
  colSpan,
}: {
  children?: React.ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <th
      colSpan={colSpan}
      className={cn(
        "whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-500",
        className
      )}
    >
      {children}
    </th>
  );
}

export function TD({
  children,
  className,
  colSpan,
}: {
  children?: React.ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td colSpan={colSpan} className={cn("px-4 py-3.5 align-middle text-ink-700", className)}>
      {children}
    </td>
  );
}
