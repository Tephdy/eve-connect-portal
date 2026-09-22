import Link from "next/link";
import { FileText, Receipt, Wrench, User as UserIcon, Building2, ScrollText } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { RecentActivity } from "@/lib/db/executive";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  invoice: Receipt,
  payment: Receipt,
  lease: FileText,
  contract: ScrollText,
  job_order: Wrench,
  app_user: UserIcon,
  property: Building2,
  unit: Building2,
};

const TONES: Record<string, string> = {
  create: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
  update: "bg-sky-500/20 text-sky-700 dark:text-sky-300",
  delete: "bg-rose-500/20 text-rose-700 dark:text-rose-300",
  archive: "bg-ink-200/60 text-ink-600 dark:bg-white/[0.06] dark:text-ink-400",
};

function timeAgo(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return Math.floor(diff / 60) + "m ago";
  if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
  if (diff < 604800) return Math.floor(diff / 86400) + "d ago";
  return new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

export function ActivityFeed({
  items,
  limit = 8,
  showViewAll,
  viewAllHref = "/admin",
}: {
  items: RecentActivity[];
  limit?: number;
  showViewAll?: boolean;
  viewAllHref?: string;
}) {
  const visible = items.slice(0, limit);

  if (visible.length === 0) {
    return (
      <p className="px-1 py-6 text-center text-sm text-ink-500">
        No recent activity.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      <ul className="space-y-1">
        {visible.map((a) => {
          const Icon = ICONS[a.entity_type] ?? FileText;
          const tone = TONES[a.action] ?? TONES.update;
          return (
            <li
              key={a.id}
              className="flex items-start gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-white/50 dark:hover:bg-white/[0.03]"
            >
              <div className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg backdrop-blur-sm", tone)}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink-800">
                  <span className="font-semibold capitalize">{a.action}</span>{" "}
                  <span className="text-ink-500">{a.entity_type.replace("_", " ")}</span>
                </p>
                <p className="truncate text-xs text-ink-500">
                  {a.actor_email ?? "system"} · {timeAgo(a.created_at)}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      {showViewAll && items.length > limit && (
        <div className="pt-1">
          <Link
            href={viewAllHref}
            className="block text-center text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
          >
            View all →
          </Link>
        </div>
      )}
    </div>
  );
}
