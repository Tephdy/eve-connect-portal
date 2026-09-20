import Link from "next/link";
import { FileText } from "lucide-react";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Card, CardBody } from "@/components/ui/card";
import { StatusPill } from "@/components/dashboard/status-pill";
import { formatPHP } from "@/lib/utils/format-php";
import type { Lease } from "@/lib/db/leases";

const STATUS_TONE: Record<string, "gray" | "green" | "yellow" | "red" | "brand"> = {
  draft: "gray",
  active: "green",
  expiring: "yellow",
  ended: "brand",
  terminated: "red",
};

export function LeaseTable({ leases }: { leases: Lease[] }) {
  return (
    <Card className="overflow-hidden">
      <CardBody className="p-0">
        <Table>
          <THead>
            <TR>
              <TH>Lease</TH>
              <TH>Tenant</TH>
              <TH>Term</TH>
              <TH className="text-right">Rent</TH>
              <TH>Status</TH>
              <TH className="text-right"></TH>
            </TR>
          </THead>
          <TBody>
            {leases.map((l) => (
              <TR key={l.id}>
                <TD>
                  <Link
                    href={"/property/leases/" + l.id}
                    className="flex items-center gap-3 group"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-ink-900 group-hover:text-brand-600 dark:group-hover:text-brand-400">
                        Unit {l.unit_number ?? "—"}
                      </p>
                      {l.intent && (
                        <p className="text-xs capitalize text-ink-500">{l.intent}</p>
                      )}
                    </div>
                  </Link>
                </TD>
                <TD className="text-ink-600">{l.tenant_name ?? "—"}</TD>
                <TD>
                  <div className="text-xs text-ink-500">
                    {new Date(l.start_date).toLocaleDateString("en-PH", {
                      month: "short",
                      day: "numeric",
                      year: "2-digit",
                    })}
                    {" → "}
                    {new Date(l.end_date).toLocaleDateString("en-PH", {
                      month: "short",
                      day: "numeric",
                      year: "2-digit",
                    })}
                  </div>
                </TD>
                <TD className="text-right font-medium text-ink-900">
                  {formatPHP(l.monthly_rent)}
                </TD>
                <TD>
                  <StatusPill tone={STATUS_TONE[l.status] ?? "gray"} dot>
                    {l.status}
                  </StatusPill>
                </TD>
                <TD className="text-right">
                  <Link
                    href={"/property/leases/" + l.id}
                    className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
                  >
                    View
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
