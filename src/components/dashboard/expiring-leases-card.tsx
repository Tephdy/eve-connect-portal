import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { StatusPill } from "./status-pill";
import type { ExpiringLease } from "@/lib/db/executive";

function tone(days: number): "red" | "yellow" | "blue" {
  if (days <= 14) return "red";
  if (days <= 30) return "yellow";
  return "blue";
}

export function ExpiringLeasesCard({ leases }: { leases: ExpiringLease[] }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Leases expiring soon"
        description={leases.length + " within 60 days"}
        action={
          <Link
            href="/property/leases"
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
          >
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        }
      />
      <CardBody className="p-0">
        {leases.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-ink-500">
            No leases expiring in the next 60 days.
          </div>
        ) : (
          <ul className="divide-y divide-ink-100 dark:divide-white/[0.04]">
            {leases.map((l) => (
              <li key={l.id}>
                <Link
                  href={"/property/leases/" + l.id}
                  className="flex items-center justify-between gap-4 px-6 py-3.5 transition-colors hover:bg-ink-50 dark:hover:bg-white/[0.03]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink-900">
                      {l.tenant_name}
                    </p>
                    <p className="truncate text-xs text-ink-500">
                      Unit {l.unit_number} · {l.property_name}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <StatusPill tone={tone(l.days_left)} dot>
                      {l.days_left}d
                    </StatusPill>
                    <span className="text-xs text-ink-500">
                      {new Date(l.end_date).toLocaleDateString("en-PH", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
