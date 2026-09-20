import Link from "next/link";
import { ArrowLeft, BarChart3 } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/guard";
import { getMonthlyRevenue, getOccupancyByProperty } from "@/lib/db/executive";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { formatPHP } from "@/lib/utils/format-php";

export default async function ReportsPage() {
  await requirePagePermission("report:read");
  const [revenue, occupancy] = await Promise.all([
    getMonthlyRevenue(12),
    getOccupancyByProperty(),
  ]);

  const total = revenue.reduce((s, r) => s + Number(r.total), 0);
  const avg = revenue.length > 0 ? total / revenue.length : 0;
  const best = revenue.reduce(
    (max, r) => (r.total > (max?.total ?? 0) ? r : max),
    revenue[0]
  );

  const totalUnits = occupancy.reduce((s, o) => s + o.total_units, 0);
  const totalOccupied = occupancy.reduce((s, o) => s + o.occupied, 0);
  const portfolioPct = totalUnits > 0 ? Math.round((totalOccupied / totalUnits) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/executive"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-ink-500 transition-colors hover:text-ink-800"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to dashboard
        </Link>
        <PageHeader
          title="Reports"
          description="12-month revenue and portfolio occupancy."
        />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="12-month total" value={formatPHP(total)} accent="brand" />
        <StatCard label="Monthly average" value={formatPHP(avg)} accent="purple" />
        <StatCard
          label="Best month"
          value={best ? best.month : "—"}
          accent="green"
          deltaLabel={best ? formatPHP(best.total) : ""}
        />
        <StatCard
          label="Portfolio occupancy"
          value={portfolioPct + "%"}
          accent="yellow"
          deltaLabel={totalOccupied + " of " + totalUnits + " units"}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Monthly revenue"
            description="Last 12 months"
            action={
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400">
                <BarChart3 className="h-4 w-4" />
              </div>
            }
          />
          <CardBody className="p-0">
            <Table>
              <THead>
                <TR>
                  <TH>Month</TH>
                  <TH className="text-right">Revenue</TH>
                </TR>
              </THead>
              <TBody>
                {revenue.length === 0 ? (
                  <TR>
                    <TD colSpan={2} className="py-10 text-center text-ink-500">
                      No revenue recorded yet.
                    </TD>
                  </TR>
                ) : (
                  revenue.map((r) => (
                    <TR key={r.month}>
                      <TD className="font-medium text-ink-900">{r.month}</TD>
                      <TD className="text-right font-medium text-success-700 dark:text-success-500">
                        {formatPHP(r.total)}
                      </TD>
                    </TR>
                  ))
                )}
              </TBody>
            </Table>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Occupancy by property"
            description={occupancy.length + " properties"}
          />
          <CardBody className="p-0">
            <Table>
              <THead>
                <TR>
                  <TH>Property</TH>
                  <TH className="text-right">Units</TH>
                  <TH className="text-right">Occupied</TH>
                  <TH className="text-right">%</TH>
                </TR>
              </THead>
              <TBody>
                {occupancy.length === 0 ? (
                  <TR>
                    <TD colSpan={4} className="py-10 text-center text-ink-500">
                      No properties yet.
                    </TD>
                  </TR>
                ) : (
                  occupancy.map((o) => (
                    <TR key={o.property_id}>
                      <TD className="font-medium text-ink-900">{o.property_name}</TD>
                      <TD className="text-right text-ink-600">{o.total_units}</TD>
                      <TD className="text-right text-ink-600">{o.occupied}</TD>
                      <TD className="text-right font-semibold text-ink-900">
                        {o.occupancy_pct}%
                      </TD>
                    </TR>
                  ))
                )}
              </TBody>
            </Table>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
