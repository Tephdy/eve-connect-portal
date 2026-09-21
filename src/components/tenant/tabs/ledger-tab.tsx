import { Card, CardBody } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { StatusPill } from "@/components/dashboard/status-pill";
import { formatPHP } from "@/lib/utils/format-php";
import type { TenantProfile } from "@/lib/db/tenant-profile";

export function LedgerTab({ profile }: { profile: TenantProfile }) {
  if (profile.ledger.length === 0) {
    return (
      <Card>
        <CardBody className="py-16 text-center text-sm text-ink-500">
          No ledger entries yet. Ledger entries are created automatically when invoices and payments are recorded.
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
              <TH>Date</TH>
              <TH>Type</TH>
              <TH>Reference</TH>
              <TH className="text-right">Amount</TH>
              <TH className="text-right">Balance after</TH>
            </TR>
          </THead>
          <TBody>
            {profile.ledger.map((entry) => (
              <TR key={entry.id}>
                <TD className="text-sm text-ink-600">
                  {new Date(entry.created_at).toLocaleDateString("en-PH", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </TD>
                <TD>
                  <StatusPill tone={entry.type === "debit" ? "red" : "green"}>
                    {entry.type}
                  </StatusPill>
                </TD>
                <TD className="text-sm text-ink-600">
                  {entry.ref_invoice_id ? entry.ref_invoice_id.slice(0, 8) : "—"}
                </TD>
                <TD className={"text-right font-medium " + (entry.type === "debit" ? "text-danger-700 dark:text-danger-500" : "text-success-700 dark:text-success-500")}>
                  {entry.type === "debit" ? "+" : "-"}
                  {formatPHP(entry.amount)}
                </TD>
                <TD className="text-right font-semibold text-ink-900">
                  {formatPHP(entry.balance_after)}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </CardBody>
    </Card>
  );
}
