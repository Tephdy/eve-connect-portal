import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/guard";
import { getMonthlyRevenue, getOccupancyByProperty } from "@/lib/db/executive";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { formatPHP } from "@/lib/utils/format-php";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";

export default async function ReportsPage() {
  await requirePagePermission("report:read");
  const [revenue, occupancy] = await Promise.all([
    getMonthlyRevenue(12),
    getOccupancyByProperty(),
  ]);

  const total = revenue.reduce((s, r) => s + Number(r.total), 0);

  return (
    <div>
      <PageHeader
        title="Reports"
        description="12-month revenue and portfolio occupancy."
        action={
          <Link href="/executive" className="text-sm text-brand-600 hover:underline">
            ← Back to dashboard
          </Link>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="Monthly revenue" description={"Total: " + formatPHP(total)} />
          <CardBody>
            <Table>
              <THead>
                <TR><TH>Month</TH><TH className="text-right">Revenue</TH></TR>
              </THead>
              <TBody>
                {revenue.map((r) => (
                  <TR key={r.month}>
                    <TD>{r.month}</TD>
                    <TD className="text-right">{formatPHP(r.total)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Occupancy by property" />
          <CardBody>
            <Table>
              <THead>
                <TR>
                  <TH>Property</TH>
                  <TH className="text-right">Units</TH>
                  <TH className="text-right">Occupied</TH>
                  <TH className="text-right">Vacant</TH>
                  <TH className="text-right">%</TH>
                </TR>
              </THead>
              <TBody>
                {occupancy.map((o) => (
                  <TR key={o.property_id}>
                    <TD className="font-medium">{o.property_name}</TD>
                    <TD className="text-right">{o.total_units}</TD>
                    <TD className="text-right">{o.occupied}</TD>
                    <TD className="text-right">{o.vacant}</TD>
                    <TD className="text-right font-medium">{o.occupancy_pct}%</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
