import { cn } from "@/lib/utils/cn";

type Tone = "gray" | "green" | "yellow" | "red" | "blue" | "purple" | "brand" | "accent" | "vivid";

const TONES: Record<Tone, string> = {
  gray:   "bg-ink-100/80 text-ink-700 dark:bg-white/[0.06] dark:text-ink-300",
  green:  "bg-emerald-500/15 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200",
  yellow: "bg-amber-400/25 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200",
  red:    "bg-rose-500/15 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200",
  blue:   "bg-sky-500/15 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200",
  purple: "bg-violet-500/15 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200",
  brand:  "bg-brand-500/15 text-brand-700 dark:bg-brand-500/25 dark:text-brand-200",
  accent: "bg-cyan-500/15 text-cyan-800 dark:bg-cyan-500/20 dark:text-cyan-200",
  vivid:  "bg-vivid-lavender/40 text-violet-900 dark:bg-vivid-lavender/20 dark:text-violet-100",
};

const DOTS: Record<Tone, string> = {
  gray:   "bg-ink-400",
  green:  "bg-emerald-500",
  yellow: "bg-amber-500",
  red:    "bg-rose-500",
  blue:   "bg-sky-500",
  purple: "bg-violet-500",
  brand:  "bg-brand-500",
  accent: "bg-cyan-500",
  vivid:  "bg-violet-400",
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
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-0.5 text-xs font-semibold backdrop-blur-sm",
        TONES[tone],
        className
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", DOTS[tone])} />}
      {children}
    </span>
  );
}
