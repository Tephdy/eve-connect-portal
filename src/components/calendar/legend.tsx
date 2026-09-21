import { cn } from "@/lib/utils/cn";
import { ALL_TYPES, TYPE_COLORS, TYPE_LABELS } from "@/lib/calendar/types";

export function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      {ALL_TYPES.map((type) => (
        <div key={type} className="flex items-center gap-2 text-xs text-ink-600">
          <span className={cn("h-2 w-2 rounded-full", TYPE_COLORS[type].dot)} />
          {TYPE_LABELS[type]}
        </div>
      ))}
    </div>
  );
}
