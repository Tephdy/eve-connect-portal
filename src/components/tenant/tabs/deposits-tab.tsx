import Link from "next/link";
import { Wallet } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { StatusPill } from "@/components/dashboard/status-pill";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { formatPHP } from "@/lib/utils/format-php";
import type { TenantProfile } from "@/lib/db/tenant-profile";

const STATUS_TONE: Record<string, "yellow" | "brand" | "green" | "red"> = {
  held: "yellow",
  partial: "brand",
  returned: "green",
  forfeited: "red",
};

export function DepositsTab({ profile }: { profile: TenantProfile }) {
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
        <Table>
          <THead>
            <TR>
              <TH>Unit</TH>
              <TH>Amount held</TH>
              <TH>Refunded</TH>
              <TH>Status</TH>
              <TH className="text-right"></TH>
            </TR>
          </THead>
          <TBody>
            {profile.deposits.map((d) => (
              <TR key={d.id}>
                <TD>
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-warning-500/10 text-warning-700 dark:text-warning-500">
                      <Wallet className="h-3.5 w-3.5" />
                    </div>
                    <span className="font-medium text-ink-900">
                      Unit {d.unit_number ?? "—"}
                    </span>
                  </div>
                </TD>
                <TD className="text-sm text-ink-900">{formatPHP(d.amount)}</TD>
                <TD className="text-sm text-ink-600">{formatPHP(d.refunded_amount)}</TD>
                <TD>
                  <StatusPill tone={STATUS_TONE[d.status] ?? "gray"} dot>
                    {d.status}
                  </StatusPill>
                </TD>
                <TD className="text-right">
                  <Link
                    href="/accounting/deposits"
                    className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
                  >
                    Manage
                  </Link>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </CardBody>
    </Card>
  );
}
