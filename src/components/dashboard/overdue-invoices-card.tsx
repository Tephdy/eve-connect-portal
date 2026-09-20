import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { StatusPill } from "./status-pill";
import { formatPHP } from "@/lib/utils/format-php";
import type { OverdueInvoice } from "@/lib/db/executive";

export function OverdueInvoicesCard({ invoices }: { invoices: OverdueInvoice[] }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Overdue invoices"
        description={invoices.length + " item" + (invoices.length === 1 ? "" : "s") + " past due"}
        action={
          <Link
            href="/accounting/invoices?filter=overdue"
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
          >
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        }
      />
      <CardBody className="p-0">
        {invoices.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-ink-500">
            Nothing overdue. 🎉
          </div>
        ) : (
          <ul className="divide-y divide-ink-100 dark:divide-white/[0.04]">
            {invoices.map((i) => (
              <li key={i.id}>
                <Link
                  href={"/accounting/invoices/" + i.id}
                  className="flex items-center justify-between gap-4 px-6 py-3.5 transition-colors hover:bg-ink-50 dark:hover:bg-white/[0.03]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink-900">
                      {i.display_number ?? i.id.slice(0, 8)}
                    </p>
                    <p className="truncate text-xs text-ink-500">
                      {i.tenant_name} · Unit {i.unit_number}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <StatusPill tone={i.days_overdue > 30 ? "red" : "yellow"}>
                      {i.days_overdue}d overdue
                    </StatusPill>
                    <span className="text-sm font-semibold text-ink-900">
                      {formatPHP(i.amount)}
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
