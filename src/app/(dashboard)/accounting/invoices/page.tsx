import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/guard";
import { listInvoices } from "@/lib/db/invoices";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/dashboard/stat-card";
import { InvoiceTable } from "@/components/accounting/invoice-table";
import { formatPHP } from "@/lib/utils/format-php";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  await requirePagePermission("invoice:read");
  const sp = await searchParams;
  const filter = (sp.filter as "all" | "unpaid" | "overdue" | "paid") ?? "all";
  const invoices = await listInvoices(filter);

  const all = await listInvoices("all");
  const unpaid = all.filter((i) => i.status === "unpaid");
  const overdue = all.filter((i) => i.status === "overdue");
  const paid = all.filter((i) => i.status === "paid");

  const sum = (arr: typeof all) => arr.reduce((s, i) => s + Number(i.amount), 0);

  const tabs = [
    { key: "all", label: "All" },
    { key: "unpaid", label: "Unpaid" },
    { key: "overdue", label: "Overdue" },
    { key: "paid", label: "Paid" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        description="All invoices with status filters."
        action={
          <Link href="/accounting/invoices/new">
            <Button>+ New Invoice</Button>
          </Link>
        }
      />

      {all.length > 0 && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Outstanding"
            value={formatPHP(sum(unpaid) + sum(overdue))}
            accent="yellow"
            deltaLabel={unpaid.length + overdue.length + " open"}
          />
          <StatCard
            label="Overdue"
            value={formatPHP(sum(overdue))}
            accent="red"
            deltaLabel={overdue.length + " past due"}
          />
          <StatCard
            label="Paid"
            value={formatPHP(sum(paid))}
            accent="green"
            deltaLabel={paid.length + " settled"}
          />
          <StatCard
            label="Total invoices"
            value={all.length}
            accent="brand"
          />
        </div>
      )}

      <div className="flex gap-1.5">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={"/accounting/invoices?filter=" + t.key}
            className={
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors " +
              (filter === t.key
                ? "bg-brand-500 text-white shadow-sm"
                : "border border-ink-200 bg-surface text-ink-600 hover:border-ink-300 hover:text-ink-900 dark:border-white/[0.06] dark:hover:border-white/[0.12]")
            }
          >
            {t.label}
          </Link>
        ))}
      </div>

      {invoices.length === 0 ? (
        <EmptyState
          title="No invoices"
          description="Create an invoice or wait for a lease signing to auto-generate one."
          action={
            <Link href="/accounting/invoices/new">
              <Button>+ New Invoice</Button>
            </Link>
          }
        />
      ) : (
        <InvoiceTable invoices={invoices} />
      )}
    </div>
  );
}
