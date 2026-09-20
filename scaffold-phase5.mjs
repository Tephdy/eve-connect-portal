#!/usr/bin/env node
/**
 * Phase 5 - Executive dashboard
 * Usage: node scaffold-phase5.mjs
 */

import { mkdir, writeFile, access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { join, dirname } from "node:path";

const ROOT = process.cwd();
const FILES = {};

async function exists(p) {
  try { await access(p, constants.F_OK); return true; } catch { return false; }
}

// =============================================================================
// DB: executive aggregations
// =============================================================================

FILES["src/lib/db/executive.ts"] =
`import "server-only";
import { createClient } from "@/lib/supabase/server";

export type ExecSummary = {
  // Revenue
  revenue_this_month: number;
  revenue_last_30d: number;
  revenue_ytd: number;
  outstanding_total: number;
  overdue_count: number;

  // Occupancy
  total_units: number;
  occupied_units: number;
  vacant_units: number;
  occupancy_pct: number;

  // Leases
  active_leases: number;
  leases_expiring_30d: number;
  leases_expiring_60d: number;

  // Maintenance
  jobs_open: number;
  jobs_pending_approval: number;
  jobs_in_progress: number;

  // Marketing
  published_listings: number;
  open_inquiries: number;
};

export async function getExecSummary(): Promise<ExecSummary> {
  const supabase = await createClient();
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
  const ytdStart = new Date(today.getFullYear(), 0, 1).toISOString();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 86400000).toISOString();
  const in30 = new Date(today.getTime() + 30 * 86400000).toISOString().slice(0, 10);
  const in60 = new Date(today.getTime() + 60 * 86400000).toISOString().slice(0, 10);

  const [
    paymentsMonth, payments30d, paymentsYtd,
    invoicesUnpaid, invoicesOverdue,
    units, leasesActive, leasesExpiring30, leasesExpiring60,
    jobsOpen, jobsPending, jobsInProgress,
    listingsPub, inquiriesOpen,
  ] = await Promise.all([
    supabase.from("payment").select("amount").gte("paid_at", monthStart),
    supabase.from("payment").select("amount").gte("paid_at", thirtyDaysAgo),
    supabase.from("payment").select("amount").gte("paid_at", ytdStart),
    supabase.from("invoice").select("amount").in("status", ["unpaid","overdue"]),
    supabase.from("invoice").select("id").eq("status", "overdue"),
    supabase.from("unit").select("status"),
    supabase.from("lease").select("id, end_date").eq("status", "active"),
    supabase.from("lease").select("id, end_date").eq("status", "active").lte("end_date", in30).gte("end_date", todayStr),
    supabase.from("lease").select("id, end_date").eq("status", "active").lte("end_date", in60).gte("end_date", todayStr),
    supabase.from("job_order").select("id").in("status", ["open","assigned","in_progress"]),
    supabase.from("job_order").select("id").eq("status", "pending_approval"),
    supabase.from("job_order").select("id").eq("status", "in_progress"),
    supabase.from("listing").select("id").eq("status", "published"),
    supabase.from("inquiry").select("id").in("status", ["open","contacted"]),
  ]);

  const sum = (rows: any[] | null) => (rows ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0);

  const unitRows = (units.data ?? []) as { status: string }[];
  const totalUnits = unitRows.length;
  const occupied = unitRows.filter((u) => u.status === "occupied").length;
  const vacant = unitRows.filter((u) => u.status === "vacant").length;
  const occPct = totalUnits > 0 ? Math.round((occupied / totalUnits) * 100) : 0;

  return {
    revenue_this_month: sum(paymentsMonth.data),
    revenue_last_30d: sum(payments30d.data),
    revenue_ytd: sum(paymentsYtd.data),
    outstanding_total: sum(invoicesUnpaid.data),
    overdue_count: (invoicesOverdue.data ?? []).length,

    total_units: totalUnits,
    occupied_units: occupied,
    vacant_units: vacant,
    occupancy_pct: occPct,

    active_leases: (leasesActive.data ?? []).length,
    leases_expiring_30d: (leasesExpiring30.data ?? []).length,
    leases_expiring_60d: (leasesExpiring60.data ?? []).length,

    jobs_open: (jobsOpen.data ?? []).length,
    jobs_pending_approval: (jobsPending.data ?? []).length,
    jobs_in_progress: (jobsInProgress.data ?? []).length,

    published_listings: (listingsPub.data ?? []).length,
    open_inquiries: (inquiriesOpen.data ?? []).length,
  };
}

export type MonthlyRevenueRow = { month: string; total: number };

export async function getMonthlyRevenue(months = 12): Promise<MonthlyRevenueRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exec_monthly_revenue")
    .select("month, total")
    .order("month", { ascending: false })
    .limit(months);
  if (error) throw new Error(error.message);
  return ((data ?? []) as MonthlyRevenueRow[]).reverse();
}

export type OccupancyByProperty = {
  property_id: string;
  property_name: string;
  total_units: number;
  occupied: number;
  vacant: number;
  unavailable: number;
  occupancy_pct: number;
};

export async function getOccupancyByProperty(): Promise<OccupancyByProperty[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exec_occupancy_by_property")
    .select("property_id, property_name, total_units, occupied, vacant, unavailable, occupancy_pct");
  if (error) throw new Error(error.message);
  return (data ?? []) as OccupancyByProperty[];
}

export type ExpiringLease = {
  id: string;
  end_date: string;
  tenant_name: string;
  unit_number: string;
  property_name: string;
  days_left: number;
};

export async function getExpiringLeases(days: number): Promise<ExpiringLease[]> {
  const supabase = await createClient();
  const today = new Date();
  const cutoff = new Date(today.getTime() + days * 86400000).toISOString().slice(0, 10);
  const todayStr = today.toISOString().slice(0, 10);

  const { data: leases } = await supabase
    .from("lease")
    .select("id, end_date, tenant_id, unit_id")
    .eq("status", "active")
    .lte("end_date", cutoff)
    .gte("end_date", todayStr)
    .order("end_date", { ascending: true });

  if (!leases || leases.length === 0) return [];

  const tenantIds = Array.from(new Set(leases.map((l) => l.tenant_id)));
  const unitIds   = Array.from(new Set(leases.map((l) => l.unit_id)));

  const [{ data: tenants }, { data: units }] = await Promise.all([
    supabase.from("tenant").select("id, full_name").in("id", tenantIds),
    supabase.from("unit").select("id, unit_number, property_id").in("id", unitIds),
  ]);

  const propIds = Array.from(new Set((units ?? []).map((u: any) => u.property_id)));
  const { data: props } = propIds.length > 0
    ? await supabase.from("property").select("id, name").in("id", propIds)
    : { data: [] as { id: string; name: string }[] };

  const tMap = new Map((tenants ?? []).map((t) => [t.id, t.full_name]));
  const uMap = new Map((units ?? []).map((u: any) => [u.id, u]));
  const pMap = new Map((props ?? []).map((p) => [p.id, p.name]));

  return leases.map((l) => {
    const u = uMap.get(l.unit_id) as any;
    const daysLeft = Math.ceil((new Date(l.end_date).getTime() - today.getTime()) / 86400000);
    return {
      id: l.id,
      end_date: l.end_date,
      tenant_name: tMap.get(l.tenant_id) ?? "—",
      unit_number: u?.unit_number ?? "—",
      property_name: u ? pMap.get(u.property_id) ?? "—" : "—",
      days_left: daysLeft,
    };
  });
}

export type OverdueInvoice = {
  id: string;
  display_number: string | null;
  amount: number;
  due_date: string;
  days_overdue: number;
  tenant_name: string;
  unit_number: string;
};

export async function getTopOverdueInvoices(limit = 10): Promise<OverdueInvoice[]> {
  const supabase = await createClient();
  const today = new Date();
  const { data: invoices } = await supabase
    .from("invoice")
    .select("id, display_number, amount, due_date, lease_id")
    .eq("status", "overdue")
    .order("due_date", { ascending: true })
    .limit(limit);

  if (!invoices || invoices.length === 0) return [];

  const leaseIds = Array.from(new Set(invoices.map((i) => i.lease_id)));
  const { data: leases } = await supabase
    .from("lease").select("id, tenant_id, unit_id").in("id", leaseIds);
  const tenantIds = Array.from(new Set((leases ?? []).map((l) => l.tenant_id)));
  const unitIds   = Array.from(new Set((leases ?? []).map((l) => l.unit_id)));

  const [{ data: tenants }, { data: units }] = await Promise.all([
    supabase.from("tenant").select("id, full_name").in("id", tenantIds),
    supabase.from("unit").select("id, unit_number").in("id", unitIds),
  ]);

  const lMap = new Map((leases ?? []).map((l) => [l.id, l]));
  const tMap = new Map((tenants ?? []).map((t) => [t.id, t.full_name]));
  const uMap = new Map((units ?? []).map((u) => [u.id, u.unit_number]));

  return invoices.map((i) => {
    const l = lMap.get(i.lease_id);
    const daysOverdue = Math.ceil((today.getTime() - new Date(i.due_date).getTime()) / 86400000);
    return {
      id: i.id,
      display_number: i.display_number,
      amount: Number(i.amount),
      due_date: i.due_date,
      days_overdue: daysOverdue,
      tenant_name: l ? tMap.get(l.tenant_id) ?? "—" : "—",
      unit_number: l ? uMap.get(l.unit_id) ?? "—" : "—",
    };
  });
}

export type RecentActivity = {
  id: string;
  actor_email: string | null;
  entity_type: string;
  entity_id: string;
  action: string;
  reason: string | null;
  created_at: string;
};

export async function getRecentActivity(limit = 20): Promise<RecentActivity[]> {
  const supabase = await createClient();
  const { data: logs } = await supabase
    .from("audit_log")
    .select("id, actor_user_id, entity_type, entity_id, action, reason, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!logs || logs.length === 0) return [];

  const actorIds = Array.from(new Set(logs.map((l: any) => l.actor_user_id).filter(Boolean)));
  const { data: users } = actorIds.length > 0
    ? await supabase.from("app_user").select("id, email").in("id", actorIds)
    : { data: [] as { id: string; email: string }[] };

  const uMap = new Map((users ?? []).map((u) => [u.id, u.email]));

  return logs.map((l: any) => ({
    id: l.id,
    actor_email: l.actor_user_id ? uMap.get(l.actor_user_id) ?? null : null,
    entity_type: l.entity_type,
    entity_id: l.entity_id,
    action: l.action,
    reason: l.reason,
    created_at: l.created_at,
  }));
}
`;

// =============================================================================
// PAGES — Executive dashboard
// =============================================================================

FILES["src/app/(dashboard)/executive/page.tsx"] =
`import Link from "next/link";
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
`;

// =============================================================================
// PAGES — Reports
// =============================================================================

FILES["src/app/(dashboard)/executive/reports/page.tsx"] =
`import Link from "next/link";
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
`;

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------
async function main() {
  const pkg = join(ROOT, "package.json");
  if (!(await exists(pkg))) {
    console.error("package.json not found. Run from project root.");
    process.exit(1);
  }
  console.log("Phase 5 - Executive dashboard\\n");
  let count = 0;
  for (const [relPath, content] of Object.entries(FILES)) {
    const full = join(ROOT, relPath);
    const exists_ = await exists(full);
    console.log((exists_ ? "  ~ " : "  + ") + relPath);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, content, "utf8");
    count++;
  }
  console.log("\\nDone - " + count + " file(s) written.\\n");
  console.log("Next:");
  console.log("  1. Run 021_exec_dashboard.sql in Supabase SQL Editor");
  console.log("  2. npm run typecheck");
  console.log("  3. npm run dev");
  console.log("\\nTest:");
  console.log("  http://localhost:3000/executive");
  console.log("  http://localhost:3000/executive/reports");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});