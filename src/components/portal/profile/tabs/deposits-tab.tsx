import { Card, CardBody } from "@/components/ui/card";
import { StatusPill } from "@/components/dashboard/status-pill";
import { formatPHP } from "@/lib/utils/format-php";
import type { TenantProfile } from "@/lib/db/tenant-profile";

const STATUS_TONE: Record<string, "gray" | "green" | "yellow" | "red"> = {
  held: "yellow",
  partial: "yellow",
  refunded: "green",
  forfeited: "red",
};

export function PortalDepositsTab({ profile }: { profile: TenantProfile }) {
  if (profile.deposits.length === 0) {
    return (
      <Card>
        <CardBody className="py-16 text-center text-sm text-ink-500">
          No deposits on file.
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardBody className="p-0">
        <div className="divide-y divide-ink-100 dark:divide-white/[0.04]">
          {profile.deposits.map((d) => (
            <div
              key={d.id}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium capitalize text-ink-900">
                  {d.status}
                  {d.unit_number ? " | Unit " + d.unit_number : ""}
                </p>
                {d.refunded_amount > 0 && (
                  <p className="mt-0.5 text-xs text-ink-500">
                    Refunded: {formatPHP(d.refunded_amount)}
                  </p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold tabular-nums text-ink-900">
                  {formatPHP(d.amount)}
                </p>
                <StatusPill tone={STATUS_TONE[d.status] ?? "gray"} dot>
                  {d.status}
                </StatusPill>
              </div>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
