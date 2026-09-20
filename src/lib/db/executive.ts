import "server-only";
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
