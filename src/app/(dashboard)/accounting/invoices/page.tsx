import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/guard";
import { listInvoices } from "@/lib/db/invoices";
import { listProperties } from "@/lib/db/properties";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/dashboard/stat-card";
import { InvoiceTable } from "@/components/accounting/invoice-table";
import { InvoiceFilters } from "@/components/accounting/invoice-filters";
import { formatPHP } from "@/lib/utils/format-php";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{
    filter?: string;
    type?: string;
    q?: string;
    from?: string;
    to?: string;
    property?: string;
  }>;
}) {
  await requirePagePermission("invoice:read");
  const sp = await searchParams;

  const status =
    (sp.filter as "all" | "unpaid" | "overdue" | "paid" | "void") ?? "all";

  const invoices = await listInvoices({
    status,
    type: sp.type ?? "all",
    q: sp.q ?? "",
    from: sp.from ?? "",
    to: sp.to ?? "",
    property_id: sp.property ?? "all",
  });

  const properties = await listProperties();

  const all = await listInvoices("all");
  const unpaid = all.filter((i) => i.status === "unpaid");
  const overdue = all.filter((i) => i.status === "overdue");
  const paid = all.filter((i) => i.status === "paid");

  const sum = (arr: typeof all) => arr.reduce((s, i) => s + Number(i.amount), 0);

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

      <InvoiceFilters
        properties={properties.map((p) => ({ id: p.id, name: p.name }))}
      />

      {invoices.length === 0 ? (
        <EmptyState
          title="No invoices"
          description="No invoices match your filters, or none exist yet."
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
