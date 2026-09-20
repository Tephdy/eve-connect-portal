import Link from "next/link";
import { Receipt, CreditCard, Wallet, CheckSquare, ArrowRight, TrendingUp } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/guard";
import { dashboardStats } from "@/lib/db/invoices";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/dashboard/stat-card";
import { formatPHP } from "@/lib/utils/format-php";

export default async function AccountingHome() {
  await requirePagePermission("invoice:read");
  const stats = await dashboardStats();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounting"
        description="Invoices, payments, deposits, and ledger."
        action={
          <div className="flex gap-2">
            <Link href="/accounting/invoices/new">
              <Button>+ New Invoice</Button>
            </Link>
            <Link href="/accounting/approvals">
              <Button variant="secondary">Approvals</Button>
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Outstanding"
          value={formatPHP(stats.outstanding)}
          accent="yellow"
          deltaLabel="awaiting collection"
        />
        <StatCard
          label="Collected this month"
          value={formatPHP(stats.collected_this_month)}
          accent="green"
          delta={12.4}
          deltaLabel="vs last month"
        />
        <StatCard
          label="Overdue invoices"
          value={stats.overdue_count}
          accent="red"
          deltaLabel={stats.overdue_count > 0 ? "action needed" : "all clear"}
        />
        <StatCard
          label="Due this week"
          value={stats.due_this_week}
          accent="brand"
          deltaLabel="upcoming"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <QuickCard
          href="/accounting/invoices"
          icon={Receipt}
          title="Invoices"
          description="All invoices, filterable by status."
        />
        <QuickCard
          href="/accounting/payments"
          icon={CreditCard}
          title="Payments"
          description="Recorded payments with receipts."
        />
        <QuickCard
          href="/accounting/deposits"
          icon={Wallet}
          title="Deposits"
          description="Held, refunded, and forfeited deposits."
        />
      </div>
    </div>
  );
}

function QuickCard({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <Link href={href} className="group">
      <Card interactive className="h-full">
        <CardBody className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 transition-colors group-hover:bg-brand-500 group-hover:text-white dark:text-brand-400">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 font-semibold text-ink-900">
              {title}
              <ArrowRight className="h-3.5 w-3.5 text-ink-400 transition-transform group-hover:translate-x-0.5" />
            </p>
            <p className="mt-0.5 text-sm text-ink-500">{description}</p>
          </div>
        </CardBody>
      </Card>
    </Link>
  );
}
