import Link from "next/link";
import { Card, CardBody } from "@/components/ui/card";
import { StatusPill } from "@/components/dashboard/status-pill";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { formatPHP } from "@/lib/utils/format-php";
import type { TenantProfile } from "@/lib/db/tenant-profile";

const STATUS_TONE: Record<string, "gray" | "green" | "yellow" | "red"> = {
  unpaid: "yellow",
  paid: "green",
  overdue: "red",
  void: "gray",
};

const TYPE_LABEL: Record<string, string> = {
  rent: "Rent",
  deposit: "Deposit",
  penalty: "Penalty",
  other: "Other",
};

export function InvoicesTab({ profile }: { profile: TenantProfile }) {
  if (profile.invoices.length === 0) {
    return (
      <Card>
        <CardBody className="py-16 text-center text-sm text-ink-500">
          No invoices on file.
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
              <TH>Invoice</TH>
              <TH>Type</TH>
              <TH>Unit</TH>
              <TH>Due</TH>
              <TH className="text-right">Amount</TH>
              <TH>Status</TH>
              <TH className="text-right"></TH>
            </TR>
          </THead>
          <TBody>
            {profile.invoices.map((inv) => (
              <TR key={inv.id}>
                <TD className="font-medium text-ink-900">
                  {inv.display_number ?? inv.id.slice(0, 8)}
                </TD>
                <TD className="text-sm text-ink-600">
                  {TYPE_LABEL[inv.type] ?? inv.type}
                </TD>
                <TD className="text-sm text-ink-600">{inv.unit_number ?? "—"}</TD>
                <TD className="text-sm text-ink-600">
                  {new Date(inv.due_date).toLocaleDateString("en-PH", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </TD>
                <TD className="text-right font-medium text-ink-900">
                  {formatPHP(inv.amount)}
                </TD>
                <TD>
                  <StatusPill tone={STATUS_TONE[inv.status] ?? "gray"} dot>
                    {inv.status}
                  </StatusPill>
                </TD>
                <TD className="text-right">
                  <Link
                    href={"/accounting/invoices/" + inv.id}
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
