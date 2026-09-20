import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/guard";
import { dashboardStats } from "@/lib/db/invoices";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatPHP } from "@/lib/utils/format-php";

export default async function AccountingHome() {
  await requirePagePermission("invoice:read");
  const stats = await dashboardStats();

  return (
    <div>
      <PageHeader
        title="Accounting"
        description="Invoices, payments, deposits, and ledger."
        action={
          <div className="flex gap-2">
            <Link href="/accounting/invoices/new"><Button>+ New Invoice</Button></Link>
            <Link href="/accounting/approvals"><Button variant="secondary">Approvals</Button></Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Stat label="Outstanding" value={formatPHP(stats.outstanding)} tone="text-gray-900" />
        <Stat label="Collected this month" value={formatPHP(stats.collected_this_month)} tone="text-green-700" />
        <Stat label="Overdue invoices" value={String(stats.overdue_count)} tone="text-red-600" />
        <Stat label="Due this week" value={String(stats.due_this_week)} tone="text-yellow-700" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <QuickCard href="/accounting/invoices" title="Invoices" desc="All invoices, filterable by status." />
        <QuickCard href="/accounting/payments" title="Payments" desc="Recorded payments with receipts." />
        <QuickCard href="/accounting/deposits" title="Deposits" desc="Held, refunded, and forfeited deposits." />
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <Card>
      <CardBody>
        <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
        <p className={"text-2xl font-semibold mt-1 " + tone}>{value}</p>
      </CardBody>
    </Card>
  );
}

function QuickCard({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link href={href} className="block">
      <Card className="hover:border-brand-500 transition-colors">
        <CardBody>
          <p className="font-medium text-brand-600">{title}</p>
          <p className="text-sm text-gray-500 mt-1">{desc}</p>
        </CardBody>
      </Card>
    </Link>
  );
}
