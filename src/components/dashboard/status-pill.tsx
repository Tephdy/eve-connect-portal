import { cn } from "@/lib/utils/cn";

type Tone = "green" | "yellow" | "red" | "blue" | "gray" | "purple" | "brand";

const TONES: Record<Tone, string> = {
  green:  "bg-success-500/15 text-success-700 dark:text-success-500",
  yellow: "bg-warning-500/15 text-warning-700 dark:text-warning-500",
  red:    "bg-danger-500/15 text-danger-700 dark:text-danger-500",
  blue:   "bg-info-500/15 text-info-700 dark:text-info-500",
  gray:   "bg-ink-100 text-ink-700 dark:bg-white/[0.06] dark:text-ink-500",
  purple: "bg-purple-500/15 text-purple-700 dark:text-purple-400",
  brand:  "bg-brand-500/15 text-brand-700 dark:text-brand-400",
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
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium capitalize",
        TONES[tone],
        className
      )}
    >
      {dot && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            tone === "green" && "bg-success-500",
            tone === "yellow" && "bg-warning-500",
            tone === "red" && "bg-danger-500",
            tone === "blue" && "bg-info-500",
            tone === "purple" && "bg-purple-500",
            tone === "brand" && "bg-brand-500",
            tone === "gray" && "bg-ink-400"
          )}
        />
      )}
      {children}
    </span>
  );
}
