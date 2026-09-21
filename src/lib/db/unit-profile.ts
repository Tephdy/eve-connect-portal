import "server-only";
import { createClient } from "@/lib/supabase/server";

export type UnitLeaseRow = {
  id: string;
  tenant_id: string;
  tenant_name: string | null;
  tenant_email: string | null;
  tenant_phone: string | null;
  tenant_messenger_name: string | null;
  tenant_government_id: string | null;
  tenant_status: string | null;
  start_date: string;
  end_date: string;
  move_in_date: string | null;
  due_date: string | null;
  monthly_rent: number;
  deposit_1: number | null;
  deposit_2: number | null;
  deposit_amount: number | null;
  ad_ons: unknown;
  ad_ons_amount: number | null;
  notice_period_days: number | null;
  term: string | null;
  intent: string | null;
  status: string;
  created_at: string;
  // Aggregated per lease
  total_invoiced: number;
  total_paid: number;
  outstanding: number;
  invoice_count: number;
  payment_count: number;
};

export type UnitProfile = {
  unit: {
    id: string;
    property_id: string;
    property_name: string | null;
    property_address: string | null;
    unit_number: string;
    floor: number | null;
    bedrooms: number | null;
    bathrooms: number | null;
    area_sqm: number | null;
    base_rent: number | null;
    status: string;
    created_at: string;
  };
  leases: UnitLeaseRow[];
  jobOrders: Array<{
    id: string;
    task_type_name: string | null;
    priority: string;
    status: string;
    description: string | null;
    cost_estimate: number | null;
    created_at: string;
  }>;
  assets: Array<{
    id: string;
    name: string;
    type: string | null;
    install_date: string | null;
    warranty_until: string | null;
  }>;
  stats: {
    current_tenant: string | null;
    lease_status: string | null;
    monthly_rent: number;
    lease_end: string | null;
    open_jobs: number;
    total_assets: number;
    total_tenants_served: number;
    lifetime_revenue: number;
  };
};

export async function getUnitProfile(id: string): Promise<UnitProfile | null> {
  const supabase = await createClient();

  const { data: unit } = await supabase
    .from("unit")
    .select(
      "id, property_id, unit_number, floor, bedrooms, bathrooms, area_sqm, base_rent, status, created_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (!unit) return null;

  const { data: property } = await supabase
    .from("property")
    .select("id, name, address")
    .eq("id", unit.property_id)
    .maybeSingle();

  // ---- Leases (all history) ----
  const { data: leases } = await supabase
    .from("lease")
    .select(
      "id, tenant_id, tenant_name, start_date, end_date, move_in_date, due_date, monthly_rent, deposit_1, deposit_2, deposit_amount, ad_ons, ad_ons_amount, notice_period_days, term, intent, status, created_at"
    )
    .eq("unit_id", id)
    .order("start_date", { ascending: false });

  const leaseRows = (leases ?? []) as any[];
  const tenantIds = Array.from(new Set(leaseRows.map((l) => l.tenant_id))).filter(Boolean);

  // ---- Tenants ----
  let tenantMap = new Map<string, any>();
  if (tenantIds.length > 0) {
    const { data: tenants } = await supabase
      .from("tenant")
      .select("id, full_name, email, phone, messenger_name, government_id, status")
      .in("id", tenantIds);
    for (const t of tenants ?? []) tenantMap.set(t.id, t);
  }

  // ---- Invoice + payment totals per lease ----
  const leaseIds = leaseRows.map((l) => l.id);

  let invoiceTotals = new Map<string, { invoiced: number; outstanding: number; count: number }>();
  let paymentTotals = new Map<string, { paid: number; count: number }>();

  if (leaseIds.length > 0) {
    const { data: invoices } = await supabase
      .from("invoice")
      .select("id, lease_id, amount, status")
      .in("lease_id", leaseIds);

    const invoiceRows = (invoices ?? []) as any[];
    const invoiceIds = invoiceRows.map((i) => i.id);

    for (const inv of invoiceRows) {
      const cur = invoiceTotals.get(inv.lease_id) ?? { invoiced: 0, outstanding: 0, count: 0 };
      const amt = Number(inv.amount ?? 0);
      cur.invoiced += amt;
      if (inv.status === "unpaid" || inv.status === "overdue") cur.outstanding += amt;
      cur.count += 1;
      invoiceTotals.set(inv.lease_id, cur);
    }

    if (invoiceIds.length > 0) {
      const { data: payments } = await supabase
        .from("payment")
        .select("invoice_id, amount")
        .in("invoice_id", invoiceIds);

      // Map invoice → lease for payment aggregation
      const invToLease = new Map(invoiceRows.map((i: any) => [i.id, i.lease_id]));

      for (const p of payments ?? []) {
        const leaseId = invToLease.get(p.invoice_id);
        if (!leaseId) continue;
        const cur = paymentTotals.get(leaseId) ?? { paid: 0, count: 0 };
        cur.paid += Number(p.amount ?? 0);
        cur.count += 1;
        paymentTotals.set(leaseId, cur);
      }
    }
  }

  const enrichedLeases: UnitLeaseRow[] = leaseRows.map((l) => {
    const tenant = tenantMap.get(l.tenant_id);
    const inv = invoiceTotals.get(l.id) ?? { invoiced: 0, outstanding: 0, count: 0 };
    const pay = paymentTotals.get(l.id) ?? { paid: 0, count: 0 };
    return {
      id: l.id,
      tenant_id: l.tenant_id,
      tenant_name: l.tenant_name ?? tenant?.full_name ?? null,
      tenant_email: tenant?.email ?? null,
      tenant_phone: tenant?.phone ?? null,
      tenant_messenger_name: tenant?.messenger_name ?? null,
      tenant_government_id: tenant?.government_id ?? null,
      tenant_status: tenant?.status ?? null,
      start_date: l.start_date,
      end_date: l.end_date,
      move_in_date: l.move_in_date,
      due_date: l.due_date,
      monthly_rent: Number(l.monthly_rent ?? 0),
      deposit_1: l.deposit_1,
      deposit_2: l.deposit_2,
      deposit_amount: l.deposit_amount,
      ad_ons: l.ad_ons,
      ad_ons_amount: l.ad_ons_amount,
      notice_period_days: l.notice_period_days,
      term: l.term,
      intent: l.intent,
      status: l.status,
      created_at: l.created_at,
      total_invoiced: inv.invoiced,
      total_paid: pay.paid,
      outstanding: inv.outstanding,
      invoice_count: inv.count,
      payment_count: pay.count,
    };
  });

  // ---- Job orders ----
  const { data: jobOrders } = await supabase
    .from("job_order")
    .select("id, task_type_id, priority, status, description, cost_estimate, created_at")
    .eq("unit_id", id)
    .order("created_at", { ascending: false });

  const taskTypeIds = Array.from(new Set((jobOrders ?? []).map((j: any) => j.task_type_id))).filter(Boolean);
  const { data: taskTypes } = taskTypeIds.length > 0
    ? await supabase.from("job_task_type").select("id, name").in("id", taskTypeIds)
    : { data: [] as { id: string; name: string }[] };
  const taskMap = new Map((taskTypes ?? []).map((t: any) => [t.id, t.name]));

  // ---- Assets ----
  const { data: assets } = await supabase
    .from("asset")
    .select("id, name, type, install_date, warranty_until")
    .eq("unit_id", id)
    .order("name");

  const activeLease = enrichedLeases.find((l) => l.status === "active" || l.status === "expiring");
  const openJobs = (jobOrders ?? []).filter((j: any) => j.status !== "done" && j.status !== "cancelled").length;

  // Lifetime revenue: sum of all payments across all leases for this unit
  const lifetime_revenue = Array.from(paymentTotals.values()).reduce((s, v) => s + v.paid, 0);

  return {
    unit: {
      ...unit,
      property_name: property?.name ?? null,
      property_address: property?.address ?? null,
    },
    leases: enrichedLeases,
    jobOrders: (jobOrders ?? []).map((j: any) => ({
      ...j,
      task_type_name: taskMap.get(j.task_type_id) ?? null,
    })),
    assets: (assets ?? []) as any[],
    stats: {
      current_tenant: activeLease?.tenant_name ?? null,
      lease_status: activeLease?.status ?? null,
      monthly_rent: Number(activeLease?.monthly_rent ?? unit.base_rent ?? 0),
      lease_end: activeLease?.end_date ?? null,
      open_jobs: openJobs,
      total_assets: (assets ?? []).length,
      total_tenants_served: new Set(enrichedLeases.map((l) => l.tenant_id)).size,
      lifetime_revenue,
    },
  };
}
