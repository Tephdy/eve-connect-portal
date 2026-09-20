import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/guard";
import {
  getExecSummary,
  getMonthlyRevenue,
  getOccupancyByProperty,
  getExpiringLeases,
  getTopOverdueInvoices,
  getRecentActivity,
} from "@/lib/db/executive";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPHP } from "@/lib/utils/format-php";
import { cn } from "@/lib/utils/cn";

export default async function ExecutiveDashboard() {
  await requirePagePermission("dashboard:executive");

  const [summary, revenue, occupancy, expiring, overdue, activity] = await Promise.all([
    getExecSummary(),
    getMonthlyRevenue(6),
    getOccupancyByProperty(),
    getExpiringLeases(60),
    getTopOverdueInvoices(5),
    getRecentActivity(15),
  ]);

  return (
    <div>
      <PageHeader
        title="Executive Dashboard"
        description="Cross-department overview — updated live."
        action={
          <Link href="/executive/reports">
            <Button variant="secondary">Reports</Button>
          </Link>
        }
      />

      {/* Headline KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <BigStat label="Revenue this month" value={formatPHP(summary.revenue_this_month)} tone="text-green-700" />
        <BigStat label="Outstanding" value={formatPHP(summary.outstanding_total)} tone="text-yellow-700" />
        <BigStat label="Occupancy" value={summary.occupancy_pct + "%"} tone="text-brand-600" />
        <BigStat label="Active leases" value={String(summary.active_leases)} tone="text-gray-900" />
      </div>

      {/* Second row: revenue, occupancy */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader title="Revenue" description="Last 6 months + totals" />
          <CardBody className="space-y-3">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <MiniStat label="Last 30 days" value={formatPHP(summary.revenue_last_30d)} />
              <MiniStat label="YTD" value={formatPHP(summary.revenue_ytd)} />
              <MiniStat label="Overdue invoices" value={String(summary.overdue_count)} />
            </div>
            <RevenueBars data={revenue} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Occupancy by property" />
          <CardBody>
            {occupancy.length === 0 ? (
              <p className="text-sm text-gray-500">No properties yet.</p>
            ) : (
              <ul className="space-y-3">
                {occupancy.map((o) => (
                  <li key={o.property_id}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{o.property_name}</span>
                      <span className="text-gray-500">
                        {o.occupied}/{o.total_units} · {o.occupancy_pct}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div className="h-full bg-brand-500" style={{ width: o.occupancy_pct + "%" }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Row 3: expiring leases + overdue invoices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader
            title="Leases expiring soon"
            description={summary.leases_expiring_30d + " in 30d · " + summary.leases_expiring_60d + " in 60d"}
            action={<Link href="/property/leases" className="text-sm text-brand-600 hover:underline">View all</Link>}
          />
          <CardBody>
            {expiring.length === 0 ? (
              <p className="text-sm text-gray-500">No leases expiring in the next 60 days.</p>
            ) : (
              <ul className="space-y-2">
                {expiring.slice(0, 6).map((l) => (
                  <li key={l.id} className="flex justify-between text-sm border-b border-gray-100 pb-2">
                    <Link href={"/property/leases/" + l.id} className="text-brand-600 hover:underline">
                      {l.tenant_name}
                    </Link>
                    <span className="text-gray-500">
                      Unit {l.unit_number} · {l.end_date} · {l.days_left}d
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Overdue invoices"
            description={summary.overdue_count + " total"}
            action={<Link href="/accounting/invoices?filter=overdue" className="text-sm text-brand-600 hover:underline">View all</Link>}
          />
          <CardBody>
            {overdue.length === 0 ? (
              <p className="text-sm text-gray-500">Nothing overdue. 🎉</p>
            ) : (
              <ul className="space-y-2">
                {overdue.map((i) => (
                  <li key={i.id} className="flex justify-between text-sm border-b border-gray-100 pb-2">
                    <Link href={"/accounting/invoices/" + i.id} className="text-brand-600 hover:underline">
                      {i.display_number ?? i.id.slice(0, 8)}
                    </Link>
                    <span className="text-gray-500">
                      {i.tenant_name} · {i.days_overdue}d late
                    </span>
                    <span className="font-medium text-red-600">{formatPHP(i.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Row 4: maintenance + marketing */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader
            title="Maintenance backlog"
            action={<Link href="/maintenance" className="text-sm text-brand-600 hover:underline">View all</Link>}
          />
          <CardBody>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <MiniStat label="Open" value={String(summary.jobs_open)} />
              <MiniStat label="Pending approval" value={String(summary.jobs_pending_approval)} tone="text-yellow-700" />
              <MiniStat label="In progress" value={String(summary.jobs_in_progress)} tone="text-blue-700" />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Marketing pulse" />
          <CardBody>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <MiniStat label="Published listings" value={String(summary.published_listings)} />
              <MiniStat label="Open inquiries" value={String(summary.open_inquiries)} />
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Row 5: recent activity */}
      <Card>
        <CardHeader title="Recent activity" description="Last 15 audit entries" />
        <CardBody>
          {activity.length === 0 ? (
            <p className="text-sm text-gray-500">No activity yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {activity.map((a) => (
                <li key={a.id} className="flex justify-between border-b border-gray-100 pb-2">
                  <span>
                    <Badge tone="gray">{a.action}</Badge>{" "}
                    <span className="text-gray-700">{a.entity_type}</span>
                  </span>
                  <span className="text-gray-500 text-xs">
                    {a.actor_email ?? "system"} · {new Date(a.created_at).toLocaleString("en-PH")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function BigStat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <Card>
      <CardBody>
        <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
        <p className={cn("text-3xl font-semibold mt-1", tone)}>{value}</p>
      </CardBody>
    </Card>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={cn("font-semibold text-lg", tone ?? "text-gray-900")}>{value}</p>
    </div>
  );
}

function RevenueBars({ data }: { data: { month: string; total: number }[] }) {
  if (data.length === 0) return <p className="text-sm text-gray-500">No revenue recorded yet.</p>;
  const max = Math.max(...data.map((d) => d.total), 1);
  return (
    <div className="flex items-end gap-2 h-28">
      {data.map((d) => {
        const pct = (d.total / max) * 100;
        return (
          <div key={d.month} className="flex-1 flex flex-col items-center">
            <div className="w-full bg-brand-100 rounded-t" style={{ height: "100%" }}>
              <div
                className="w-full bg-brand-500 rounded-t transition-all"
                style={{ height: pct + "%", marginTop: (100 - pct) + "%" }}
              />
            </div>
            <span className="text-[10px] text-gray-500 mt-1">{d.month.slice(5)}</span>
          </div>
        );
      })}
    </div>
  );
}
