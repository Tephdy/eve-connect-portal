import { cn } from "@/lib/utils/cn";

type Tone = "green" | "yellow" | "red" | "blue" | "gray" | "purple" | "brand";

const TONES: Record<Tone, string> = {
  green:  "bg-emerald-500/15 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200",
  yellow: "bg-amber-400/25 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200",
  red:    "bg-rose-500/15 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200",
  blue:   "bg-sky-500/15 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200",
  gray:   "bg-ink-100/80 text-ink-700 dark:bg-white/[0.06] dark:text-ink-300",
  purple: "bg-violet-500/15 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200",
  brand:  "bg-brand-500/15 text-brand-700 dark:bg-brand-500/25 dark:text-brand-200",
};

const DOTS: Record<Tone, string> = {
  green:  "bg-emerald-500",
  yellow: "bg-amber-500",
  red:    "bg-rose-500",
  blue:   "bg-sky-500",
  gray:   "bg-ink-400",
  purple: "bg-violet-500",
  brand:  "bg-brand-500",
};

export function StatusPill({
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
        "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold capitalize backdrop-blur-sm",
        TONES[tone],
        className
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", DOTS[tone])} />}
      {children}
    </span>
  );
}
