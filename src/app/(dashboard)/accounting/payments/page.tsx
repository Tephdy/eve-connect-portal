import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/guard";
import { listPayments } from "@/lib/db/payments";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Card, CardBody } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { StatCard } from "@/components/dashboard/stat-card";
import { formatPHP } from "@/lib/utils/format-php";
import { Receipt, CreditCard } from "lucide-react";

export default async function PaymentsPage() {
  await requirePagePermission("payment:read");
  const payments = await listPayments();

  const total = payments.reduce((s, p) => s + Number(p.amount), 0);
  const thisMonth = payments.filter((p) => {
    const d = new Date(p.paid_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const thisMonthTotal = thisMonth.reduce((s, p) => s + Number(p.amount), 0);
  const avg = payments.length > 0 ? total / payments.length : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description="All recorded payments with printable receipts."
      />

      {payments.length > 0 && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Total collected"
            value={formatPHP(total)}
            accent="green"
          />
          <StatCard
            label="This month"
            value={formatPHP(thisMonthTotal)}
            accent="brand"
            deltaLabel={thisMonth.length + " payments"}
          />
          <StatCard
            label="Average payment"
            value={formatPHP(avg)}
            accent="purple"
          />
          <StatCard
            label="Receipts issued"
            value={payments.length}
            accent="yellow"
          />
        </div>
      )}

      {payments.length === 0 ? (
        <EmptyState
          title="No payments yet"
          description="Record payments from the invoice detail page."
        />
      ) : (
        <Card className="overflow-hidden">
          <CardBody className="p-0">
            <Table>
              <THead>
                <TR>
                  <TH>Receipt</TH>
                  <TH>Invoice</TH>
                  <TH>Payment for</TH>
                  <TH>Tenant</TH>
                  <TH>Method</TH>
                  <TH>Paid at</TH>
                  <TH className="text-right">Amount</TH>
                  <TH className="text-right"></TH>
                </TR>
              </THead>
              <TBody>
                {payments.map((p) => (
                  <TR key={p.id}>
                    <TD>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-success-500/10 text-success-700 dark:text-success-500">
                          <Receipt className="h-4 w-4" />
                        </div>
                        <span className="font-medium text-ink-900">
                          {p.receipt_number ?? "—"}
                        </span>
                      </div>
                    </TD>
                    <TD className="text-ink-600">{p.invoice_display ?? "—"}</TD>
                    <TD className="capitalize text-ink-600">{
                      ({
                        rent: "Rent",
                        utility: "Utility",
                        deposit: "Deposit",
                        penalty: "Penalty",
                        "add-ons": "Add-ons",
                        reservation_fee: "Reservation fee",
                        other: "Other",
                      } as Record<string, string>)[p.invoice_type ?? ""] ?? (p.invoice_type ?? "—")
                    }</TD>
                    <TD className="text-ink-600">{p.tenant_name ?? "—"}</TD>
                    <TD>
                      <span className="inline-flex items-center gap-1.5 text-sm text-ink-600">
                        <CreditCard className="h-3.5 w-3.5 text-ink-400" />
                        <span className="capitalize">{p.method.replace("_", " ")}</span>
                      </span>
                    </TD>
                    <TD className="text-xs text-ink-500">
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
      )}
    </div>
  );
}
