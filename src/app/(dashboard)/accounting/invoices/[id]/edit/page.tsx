import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/guard";
import { getInvoice } from "@/lib/db/invoices";
import { PageHeader } from "@/components/layout/page-header";
import { InvoiceEditForm } from "@/components/accounting/invoice-edit-form";

export default async function InvoiceEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("invoice:read");
  const { id } = await params;
  const invoice = await getInvoice(id);
  if (!invoice) notFound();

  // Server-side guard: cannot edit paid/void invoices
  if (invoice.status === "paid" || invoice.status === "void") {
    redirect("/accounting/invoices/" + id);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit invoice"
        description={invoice.display_number ?? invoice.id.slice(0, 8)}
      />
      <InvoiceEditForm invoice={invoice} />
      <p className="text-xs text-ink-500">
        <Link
          href={"/accounting/invoices/" + id}
          className="text-brand-600 hover:underline"
        >
          ← Back to invoice
        </Link>
      </p>
    </div>
  );
}