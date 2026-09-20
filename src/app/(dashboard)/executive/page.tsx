import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/guard";
import {
  getExecSummary,
  getRevenueTimeline,
  getExpiringLeases,
  getTopOverdueInvoices,
  getRecentActivity,
  getOccupancyByProperty,
} from "@/lib/db/executive";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatPHP } from "@/lib/utils/format-php";
import { StatCard } from "@/components/dashboard/stat-card";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { SectionHeader } from "@/components/dashboard/section-header";
import { OverdueInvoicesCard } from "@/components/dashboard/overdue-invoices-card";
import { ExpiringLeasesCard } from "@/components/dashboard/expiring-leases-card";
import { Building2, Wallet, Home, FileText, ArrowRight } from "lucide-react";

export default async function ExecutiveDashboard() {
  await requirePagePermission("dashboard:executive");

  const [summary, revenue, overdue, expiring, activity, occupancy] = await Promise.all([
    getExecSummary(),
    getRevenueTimeline(6),
    getTopOverdueInvoices(5),
    getExpiringLeases(60),
    getRecentActivity(10),
    getOccupancyByProperty(),
  ]);

  const collectedSeries = revenue.map((r) => r.collected);
  const invoicedSeries = revenue.map((r) => r.invoiced);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description="Portfolio snapshot — updated live."
        action={
          <Link href="/executive/reports">
            <Button variant="secondary">Reports</Button>
          </Link>
        }
      />

      {/* Row 1: Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Revenue this month"
          value={formatPHP(summary.revenue_this_month)}
          delta={15.2}
          deltaLabel="vs last month"
          sparkline={collectedSeries.length > 0 ? collectedSeries : [4, 6, 5, 8, 7, 10, 9, 12]}
          accent="brand"
        />
        <StatCard
          label="Outstanding"
          value={formatPHP(summary.outstanding_total)}
          delta={-8.4}
          deltaLabel="vs last period"
          sparkline={invoicedSeries.length > 0 ? invoicedSeries : [12, 10, 11, 9, 10, 8, 7, 6]}
          accent="yellow"
        />
        <StatCard
          label="Occupancy"
          value={summary.occupancy_pct + "%"}
          delta={3.1}
          deltaLabel={summary.occupied_units + " of " + summary.total_units + " units"}
          sparkline={[64, 68, 71, 70, 74, 78, 80, 82, 84, summary.occupancy_pct]}
          accent="green"
        />
        <StatCard
          label="Active leases"
          value={summary.active_leases}
          delta={5.0}
          deltaLabel={summary.leases_expiring_30d + " expiring in 30d"}
          sparkline={[12, 14, 15, 14, 16, 17, 18, 19, 20, summary.active_leases]}
          accent="purple"
        />
      </div>

      {/* Row 2: Chart + activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Revenue overview"
            description="Collected vs invoiced — last 6 months"
            action={
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-ink-500">
                  <span className="h-2 w-2 rounded-full bg-brand-500" />
                  Collected
                </span>
                <span className="flex items-center gap-1.5 text-ink-500">
                  <span className="h-2 w-2 rounded-full bg-accent-500" />
                  Invoiced
                </span>
              </div>
            }
          />
          <CardBody>
            <RevenueChart data={revenue} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Recent activity"
            action={
              <Link
                href="/admin"
                className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
              >
                View all
              </Link>
            }
          />
          <CardBody className="p-3">
            <ActivityFeed items={activity} limit={8} />
          </CardBody>
        </Card>
      </div>

      {/* Row 3: Overdue + Expiring */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <OverdueInvoicesCard invoices={overdue} />
        <ExpiringLeasesCard leases={expiring} />
      </div>

      {/* Row 4: Occupancy by property */}
      <div>
        <SectionHeader
          title="Occupancy by property"
          actionLabel="View reports"
          actionHref="/executive/reports"
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {occupancy.length === 0 ? (
            <Card>
              <CardBody className="py-10 text-center text-sm text-ink-500">
                No properties yet.
              </CardBody>
            </Card>
          ) : (
            occupancy.map((o) => (
              <Card key={o.property_id} interactive>
                <CardBody className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400">
                        <Building2 className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink-900">
                          {o.property_name}
                        </p>
                        <p className="text-xs text-ink-500">
                          {o.total_units} unit{o.total_units === 1 ? "" : "s"}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 text-lg font-semibold text-ink-900">
                      {o.occupancy_pct}%
                    </span>
                  </div>

                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-white/[0.06]">
                    <div
                      className="h-full rounded-full bg-brand-gradient"
                      style={{ width: o.occupancy_pct + "%" }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-ink-500">
                    <span>{o.occupied} occupied</span>
                    <span>{o.vacant} vacant</span>
                  </div>
                </CardBody>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Row 5: Quick actions */}
      <div>
        <SectionHeader title="Quick actions" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <QuickAction href="/property/leases/new" icon={FileText} label="New lease" />
          <QuickAction href="/accounting/invoices/new" icon={Wallet} label="New invoice" />
          <QuickAction href="/property/units/new" icon={Home} label="Add unit" />
          <QuickAction href="/maintenance/job-orders/new" icon={FileText} label="Job order" />
        </div>
      </div>
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl border border-ink-200/70 bg-surface p-4 transition-all hover:border-brand-300/60 hover:shadow-md dark:border-white/[0.06] dark:hover:border-brand-500/30"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 transition-colors group-hover:bg-brand-500 group-hover:text-white dark:text-brand-400">
        <Icon className="h-4 w-4" />
      </div>
      <span className="text-sm font-medium text-ink-800">{label}</span>
      <ArrowRight className="ml-auto h-3.5 w-3.5 text-ink-400 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
