import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/guard";
import { listInvoices } from "@/lib/db/invoices";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { InvoiceTable } from "@/components/accounting/invoice-table";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  await requirePagePermission("invoice:read");
  const sp = await searchParams;
  const filter = (sp.filter as "all" | "unpaid" | "overdue" | "paid") ?? "all";
  const invoices = await listInvoices(filter);

  const tabs = [
    { key: "all", label: "All" },
    { key: "unpaid", label: "Unpaid" },
    { key: "overdue", label: "Overdue" },
    { key: "paid", label: "Paid" },
  ];

  return (
    <div>
      <PageHeader
        title="Invoices"
        description="All invoices with status filters."
        action={<Link href="/accounting/invoices/new"><Button>+ New Invoice</Button></Link>}
      />

      <div className="flex gap-2 mb-4">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/accounting/invoices?filter=${t.key}`}
            className={
              "px-3 py-1.5 rounded text-sm " +
              (filter === t.key
                ? "bg-brand-500 text-white"
                : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50")
            }
          >
            {t.label}
          </Link>
        ))}
      </div>

      {invoices.length === 0 ? (
        <EmptyState
          title="No invoices"
          description="Create an invoice or wait for lease signing to auto-generate one."
        />
      ) : (
        <InvoiceTable invoices={invoices} />
      )}
    </div>
  );
}
