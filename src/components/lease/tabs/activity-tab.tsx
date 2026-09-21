import {
  FileText,
  Receipt,
  CreditCard,
  ScrollText,
  CheckCircle2,
  AlertCircle,
  Info,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Card, CardBody } from "@/components/ui/card";
import { StatusPill } from "@/components/dashboard/status-pill";
import type { LeaseProfile } from "@/lib/db/lease-profile";

function iconForType(entity_type: string) {
  if (entity_type === "invoice") return Receipt;
  if (entity_type === "payment") return CreditCard;
  if (entity_type === "contract") return ScrollText;
  if (entity_type === "lease") return FileText;
  if (entity_type === "job_order") return Wrench;
  return FileText;
}

const ACTION_COLOR: Record<string, { bg: string; text: string; icon: React.ComponentType<{ className?: string }> }> = {
  create: { bg: "bg-success-500/10", text: "text-success-700 dark:text-success-500", icon: CheckCircle2 },
  update: { bg: "bg-info-500/10", text: "text-info-700 dark:text-info-500", icon: Info },
  delete: { bg: "bg-danger-500/10", text: "text-danger-700 dark:text-danger-500", icon: AlertCircle },
  archive: { bg: "bg-ink-100 dark:bg-white/[0.06]", text: "text-ink-600", icon: FileText },
};

function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return Math.floor(diff / 60) + "m ago";
  if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
  if (diff < 604800) return Math.floor(diff / 86400) + "d ago";
  return new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

export function LeaseActivityTab({ profile }: { profile: LeaseProfile }) {
  if (profile.activity.length === 0) {
    return (
      <Card>
        <CardBody className="py-16 text-center text-sm text-ink-500">
          No activity recorded yet.
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody>
        <ol className="relative space-y-4 pl-8">
          {/* Vertical line */}
          <div className="absolute left-3 top-2 bottom-2 w-px bg-ink-200 dark:bg-white/[0.08]" />

          {profile.activity.map((a) => {
            const color = ACTION_COLOR[a.action] ?? ACTION_COLOR.update;
            const TypeIcon = iconForType(a.entity_type);
            const ActionIcon = color.icon;
            return (
              <li key={a.id} className="relative">
                <div className={cn(
                  "absolute -left-8 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-surface",
                  color.bg
                )}>
                  <ActionIcon className={cn("h-3.5 w-3.5", color.text)} />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill tone="gray">
                    <TypeIcon className="mr-1 h-3 w-3" />
                    {a.entity_type.replace("_", " ")}
                  </StatusPill>
                  <span className="text-sm font-medium capitalize text-ink-800">
                    {a.action}
                  </span>
                  <span className="text-xs text-ink-400">
                    {relativeTime(a.created_at)}
                  </span>
                </div>

                {a.reason && (
                  <p className="mt-1 text-xs text-ink-500">{a.reason}</p>
                )}
              </li>
            );
          })}
        </ol>
      </CardBody>
    </Card>
  );
}
