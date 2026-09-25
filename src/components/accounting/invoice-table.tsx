import Link from "next/link";
import { Receipt } from "lucide-react";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Card, CardBody } from "@/components/ui/card";
import { StatusPill } from "@/components/dashboard/status-pill";
import { formatPHP } from "@/lib/utils/format-php";
import type { Invoice } from "@/lib/db/invoices";

const STATUS_TONE: Record<string, "gray" | "green" | "yellow" | "red"> = {
  unpaid: "yellow",
  paid: "green",
  overdue: "red",
  void: "gray",
};

const TYPE_LABEL: Record<string, string> = {
  rent: "Rent",
  utility: "Utility",
  deposit: "Deposit",
  penalty: "Penalty",
  "add-ons": "Add-ons",
  reservation_fee: "Reservation fee",
  other: "Other",
};

export function InvoiceTable({ invoices }: { invoices: Invoice[] }) {
  return (
    <Card className="overflow-hidden">
      <CardBody className="p-0">
        <Table>
          <THead>
            <TR>
              <TH>Invoice</TH>
              <TH>Tenant</TH>
              <TH>Type</TH>
              <TH>Due</TH>
              <TH className="text-right">Amount</TH>
              <TH>Status</TH>
              <TH className="text-right"></TH>
            </TR>
          </THead>
          <TBody>
            {invoices.map((inv) => {
              const overdue = inv.status === "overdue";
              return (
                <TR key={inv.id}>
                  <TD>
                    <Link
                      href={"/accounting/invoices/" + inv.id}
                      className="flex items-center gap-3 group"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400">
                        <Receipt className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink-900 group-hover:text-brand-600 dark:group-hover:text-brand-400">
                          {inv.display_number ?? inv.id.slice(0, 8)}
                        </p>
                        {inv.unit_number && (
                          <p className="truncate text-xs text-ink-500">
                            Unit {inv.unit_number}
                          </p>
                        )}
                      </div>
                    </Link>
                  </TD>
                  <TD className="text-ink-600">{inv.tenant_name ?? "—"}</TD>
                  <TD>
                    <span className="text-sm capitalize text-ink-600">
                      {TYPE_LABEL[inv.type] ?? inv.type}
                    </span>
                  </TD>
                  <TD>
                    <span className={"text-sm " + (overdue ? "font-medium text-danger-600 dark:text-danger-500" : "text-ink-600")}>
                      {new Date(inv.due_date).toLocaleDateString("en-PH", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
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
              );
            })}
          </TBody>
        </Table>
      </CardBody>
    </Card>
  );
}
