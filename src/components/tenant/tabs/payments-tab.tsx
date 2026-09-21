import Link from "next/link";
import { Receipt } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { formatPHP } from "@/lib/utils/format-php";
import type { TenantProfile } from "@/lib/db/tenant-profile";

export function PaymentsTab({ profile }: { profile: TenantProfile }) {
  if (profile.payments.length === 0) {
    return (
      <Card>
        <CardBody className="py-16 text-center text-sm text-ink-500">
          No payments on file.
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
              <TH>Receipt</TH>
              <TH>Invoice</TH>
              <TH>Method</TH>
              <TH>Paid at</TH>
              <TH className="text-right">Amount</TH>
              <TH className="text-right"></TH>
            </TR>
          </THead>
          <TBody>
            {profile.payments.map((p) => (
              <TR key={p.id}>
                <TD>
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-success-500/10 text-success-700 dark:text-success-500">
                      <Receipt className="h-3.5 w-3.5" />
                    </div>
                    <span className="font-medium text-ink-900">
                      {p.receipt_number ?? "—"}
                    </span>
                  </div>
                </TD>
                <TD className="text-sm text-ink-600">{p.invoice_display ?? "—"}</TD>
                <TD className="text-sm text-ink-600 capitalize">
                  {p.method.replace("_", " ")}
                </TD>
                <TD className="text-sm text-ink-600">
                  {new Date(p.paid_at).toLocaleDateString("en-PH", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </TD>
                <TD className="text-right font-medium text-success-700 dark:text-success-500">
                  {formatPHP(p.amount)}
                </TD>
                <TD className="text-right">
                  <Link
                    href={"/accounting/payments/" + p.id + "/receipt"}
                    className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
                  >
                    Receipt
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
