import { cn } from "@/lib/utils/cn";

export function HealthGauge({ score, className }: { score: number; className?: string }) {
  const clamped = Math.max(0, Math.min(100, score));
  const textColor =
    clamped >= 90 ? "text-emerald-500" :
    clamped >= 70 ? "text-amber-500" :
    clamped >= 40 ? "text-orange-500" : "text-rose-500";
  const ringColor =
    clamped >= 90 ? "stroke-emerald-500" :
    clamped >= 70 ? "stroke-amber-500" :
    clamped >= 40 ? "stroke-orange-500" : "stroke-rose-500";

  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - clamped / 100);

  return (
    <div className={cn("relative flex h-32 w-32 items-center justify-center", className)}>
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={radius} fill="none" strokeWidth="8" className="stroke-white/50 dark:stroke-white/[0.06]" />
        <circle
          cx="50" cy="50" r={radius} fill="none" strokeWidth="8" strokeLinecap="round"
          className={ringColor}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: "stroke-dashoffset 600ms cubic-bezier(0.4,0,0.2,1)" }}
        />
      </svg>
      <div className="relative text-center">
        <p className={cn("text-3xl font-bold tabular-nums", textColor)}>{clamped}</p>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">Health</p>
      </div>
    </div>
  );
}
