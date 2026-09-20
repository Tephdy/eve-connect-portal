import { cn } from "@/lib/utils/cn";

type Tone = "gray" | "green" | "yellow" | "red" | "blue" | "purple" | "brand" | "accent";

const TONES: Record<Tone, string> = {
  gray:   "bg-ink-100 text-ink-700 dark:bg-white/[0.06] dark:text-ink-600",
  green:  "bg-success-100 text-success-700 dark:bg-success-500/15 dark:text-success-500",
  yellow: "bg-warning-100 text-warning-700 dark:bg-warning-500/15 dark:text-warning-500",
  red:    "bg-danger-100 text-danger-700 dark:bg-danger-500/15 dark:text-danger-500",
  blue:   "bg-info-100 text-info-700 dark:bg-info-500/15 dark:text-info-500",
  purple: "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400",
  brand:  "bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-400",
  accent: "bg-accent-500/15 text-accent-600 dark:text-accent-400",
};

const DOTS: Record<Tone, string> = {
  gray:   "bg-ink-400",
  green:  "bg-success-500",
  yellow: "bg-warning-500",
  red:    "bg-danger-500",
  blue:   "bg-info-500",
  purple: "bg-purple-500",
  brand:  "bg-brand-500",
  accent: "bg-accent-500",
};

export function Badge({
  children,
  tone = "gray",
  dot,
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium",
        TONES[tone],
        className
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", DOTS[tone])} />}
      {children}
    </span>
  );
}
