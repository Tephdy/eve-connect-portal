import Link from "next/link";
import { AlertTriangle, Info, AlertOctagon, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { PortalNotification } from "@/lib/db/tenant-notifications";

const SEVERITY_STYLES = {
  danger: {
    bg: "bg-danger-500/10 border-danger-500/30",
    text: "text-danger-700 dark:text-danger-500",
    icon: AlertOctagon,
  },
  warning: {
    bg: "bg-amber-500/10 border-amber-500/30",
    text: "text-amber-800 dark:text-amber-400",
    icon: AlertTriangle,
  },
  info: {
    bg: "bg-brand-500/10 border-brand-500/30",
    text: "text-brand-700 dark:text-brand-400",
    icon: Info,
  },
} as const;

export function NotificationBanner({
  notifications,
}: {
  notifications: PortalNotification[];
}) {
  if (notifications.length === 0) return null;

  const top = notifications[0];
  const style = SEVERITY_STYLES[top.severity];
  const Icon = style.icon;

  return (
    <Link
      href={top.href}
      className={cn(
        "mb-4 flex items-center gap-3 rounded-2xl border px-4 py-3 transition-colors hover:brightness-[0.98]",
        style.bg
      )}
    >
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/60 dark:bg-white/[0.08]",
          style.text
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-semibold", style.text)}>{top.title}</p>
        <p className="mt-0.5 line-clamp-2 text-xs text-ink-600 dark:text-ink-400">
          {top.body}
        </p>
      </div>
      {notifications.length > 1 && (
        <span className="shrink-0 rounded-full bg-white/60 px-2 py-0.5 text-[10px] font-semibold text-ink-600 dark:bg-white/[0.08] dark:text-ink-300">
          +{notifications.length - 1}
        </span>
      )}
      <ChevronRight className={cn("h-4 w-4 shrink-0", style.text)} />
    </Link>
  );
}
