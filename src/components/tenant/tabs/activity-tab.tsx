import { Card, CardBody } from "@/components/ui/card";
import { StatusPill } from "@/components/dashboard/status-pill";
import type { TenantProfile } from "@/lib/db/tenant-profile";

const ACTION_TONE: Record<string, "green" | "brand" | "red" | "gray"> = {
  create: "green",
  update: "brand",
  delete: "red",
  archive: "gray",
};

export function ActivityTab({ profile }: { profile: TenantProfile }) {
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
      <CardBody className="p-0">
        <ul className="divide-y divide-ink-100 dark:divide-white/[0.04]">
          {profile.activity.map((a) => (
            <li key={a.id} className="flex items-start gap-3 px-5 py-3">
              <StatusPill tone={ACTION_TONE[a.action] ?? "gray"}>
                {a.action}
              </StatusPill>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-ink-800">
                  <span className="capitalize">{a.action}</span>{" "}
                  <span className="text-ink-500">{a.entity_type.replace("_", " ")}</span>
                </p>
                {a.reason && (
                  <p className="mt-0.5 text-xs text-ink-500">{a.reason}</p>
                )}
              </div>
              <span className="shrink-0 text-xs text-ink-400">
                {new Date(a.created_at).toLocaleString("en-PH", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
