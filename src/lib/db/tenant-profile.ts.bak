import "server-only";
import { createClient } from "@/lib/supabase/server";

export type TenantProfile = {
  tenant: {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    messenger_name: string | null;
    government_id: string | null;
    status: string;
    created_at: string;
  };
  leases: Array<{
    id: string;
    unit_id: string;
    unit_number: string | null;
    property_name: string | null;
    start_date: string;
    end_date: string;
    monthly_rent: number;
    deposit_amount: number;
    status: string;
    term: string | null;
    intent: string | null;
    move_in_date: string | null;
    due_date: string | null;
  }>;
  invoices: Array<{
    id: string;
    lease_id: string;
    display_number: string | null;
    type: string;
    amount: number;
    due_date: string;
    status: string;
    created_at: string;
    unit_number: string | null;
  }>;
  payments: Array<{
    id: string;
    invoice_id: string;
    receipt_number: string | null;
    amount: number;
    method: string;
    reference_no: string | null;
    paid_at: string;
    invoice_display: string | null;
  }>;
  deposits: Array<{
    id: string;
    lease_id: string;
    amount: number;
    status: string;
    refunded_amount: number;
    unit_number: string | null;
  }>;
  ledger: Array<{
    id: string;
    type: string;
    amount: number;
    balance_after: number;
    ref_invoice_id: string | null;
    created_at: string;
  }>;
  activity: Array<{
    id: string;
    action: string;
    entity_type: string;
    entity_id: string;
    created_at: string;
    reason: string | null;
  }>;
  stats: {
    total_invoiced: number;
    total_paid: number;
    outstanding: number;
    overdue_count: number;
    current_balance: number;
    active_leases: number;
    deposit_held: number;
    /** Earliest move-in date across all leases. Null if no leases have move-in dates. */
    first_move_in_date: string | null;
  };
};

export async function getTenantProfile(tenant_id: string): Promise<TenantProfile | null> {
  const supabase = await createClient();

  const { data: tenant } = await supabase
    .from("tenant")
    .select("id, full_name, email, phone, messenger_name, government_id, status, created_at")
    .eq("id", tenant_id)
    .maybeSingle();

  if (!tenant) return null;

  const { data: leases } = await supabase
    .from("lease")
    .select(
      "id, unit_id, unit_number, start_date, end_date, monthly_rent, deposit_amount, status, term, intent, move_in_date, due_date"
    )
    .eq("tenant_id", tenant_id)
    .order("start_date", { ascending: false });

  const leaseRows = (leases ?? []) as any[];
  const leaseIds = leaseRows.map((l) => l.id);
  const unitIds = Array.from(new Set(leaseRows.map((l) => l.unit_id))).filter(Boolean);

  let unitMap = new Map<string, { unit_number: string; property_name: string }>();
  if (unitIds.length > 0) {
    const { data: units } = await supabase
      .from("unit")
      .select("id, unit_number, property_id")
      .in("id", unitIds);

    const propIds = Array.from(new Set((units ?? []).map((u: any) => u.property_id))).filter(Boolean);
    const { data: props } = propIds.length > 0
      ? await supabase.from("property").select("id, name").in("id", propIds)
      : { data: [] as { id: string; name: string }[] };

    const propMap = new Map((props ?? []).map((p: any) => [p.id, p.name]));
    for (const u of units ?? []) {
      unitMap.set(u.id, {
        unit_number: u.unit_number,
        property_name: propMap.get(u.property_id) ?? "",
      });
    }
  }

  const enrichedLeases = leaseRows.map((l) => ({
    ...l,
    property_name: unitMap.get(l.unit_id)?.property_name ?? null,
    unit_number: l.unit_number ?? unitMap.get(l.unit_id)?.unit_number ?? null,
  }));

  // Query invoices by tenant_id directly. Reservation-fee invoices
  // have lease_id = null but do have tenant_id, so this catches them.
  const { data: invoiceData } = await supabase
    .from("invoice")
    .select("id, lease_id, display_number, type, amount, due_date, status, created_at")
    .eq("tenant_id", tenant_id)
    .order("due_date", { ascending: false });
  const invoices: any[] = invoiceData ?? [];

  const invoiceIds = invoices.map((i) => i.id);
  const invoiceMap = new Map(invoices.map((i) => [i.id, i]));
  const leaseToUnit = new Map(leaseRows.map((l) => [l.id, l.unit_id]));

  const enrichedInvoices = invoices.map((inv) => ({
    ...inv,
    unit_number: unitMap.get(leaseToUnit.get(inv.lease_id) ?? "")?.unit_number ?? null,
  }));

  // Query payments by tenant_id directly
  const { data: paymentData } = await supabase
    .from("payment")
    .select("id, invoice_id, receipt_number, amount, method, reference_no, paid_at")
    .eq("tenant_id", tenant_id)
    .order("paid_at", { ascending: false });
  const payments: any[] = paymentData ?? [];

  const enrichedPayments = payments.map((p) => ({
    ...p,
    invoice_display: invoiceMap.get(p.invoice_id)?.display_number ?? null,
  }));

  let deposits: any[] = [];
  if (leaseIds.length > 0) {
    const { data } = await supabase
      .from("deposit")
      .select("id, lease_id, amount, status, refunded_amount")
      .in("lease_id", leaseIds);
    deposits = data ?? [];
  }

  const enrichedDeposits = deposits.map((d) => ({
    ...d,
    unit_number: unitMap.get(leaseToUnit.get(d.lease_id) ?? "")?.unit_number ?? null,
  }));

  const { data: ledger } = await supabase
    .from("ledger_entry")
    .select("id, type, amount, balance_after, ref_invoice_id, created_at")
    .eq("tenant_id", tenant_id)
    .order("created_at", { ascending: false });

  const entityIds = [
    tenant_id,
    ...leaseIds,
    ...invoiceIds,
    ...payments.map((p: any) => p.id),
  ];

  const { data: activity } = entityIds.length > 0
    ? await supabase
        .from("audit_log")
        .select("id, action, entity_type, entity_id, created_at, reason")
        .in("entity_id", entityIds)
        .order("created_at", { ascending: false })
        .limit(50)
    : { data: [] as any[] };

  const total_invoiced = invoices.reduce((s, i) => s + Number(i.amount ?? 0), 0);
  const total_paid = payments.reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const outstanding = invoices
    .filter((i) => i.status === "unpaid" || i.status === "overdue")
    .reduce((s, i) => s + Number(i.amount ?? 0), 0);
  const overdue_count = invoices.filter((i) => i.status === "overdue").length;
  const deposit_held = deposits
    .filter((d) => d.status === "held" || d.status === "partial")
    .reduce((s, d) => s + Number(d.amount ?? 0), 0);
  const active_leases = leaseRows.filter((l) => l.status === "active" || l.status === "expiring").length;
  const current_balance = total_invoiced - total_paid;

  // ---- Compute the tenant's first move-in date ----
  // Priority:
  //   1. Earliest lease.move_in_date (most accurate for "actually moved in")
  //   2. Earliest lease.start_date (fallback if move_in_date is missing)
  //   3. Tenant's created_at (fallback if no leases at all)
  const moveInDates = leaseRows
    .map((l) => l.move_in_date)
    .filter((d): d is string => !!d);

  let first_move_in_date: string | null = null;
  if (moveInDates.length > 0) {
    first_move_in_date = moveInDates.sort()[0];
  } else {
    const startDates = leaseRows
      .map((l) => l.start_date)
      .filter((d): d is string => !!d);
    if (startDates.length > 0) {
      first_move_in_date = startDates.sort()[0];
    } else {
      first_move_in_date = tenant.created_at.slice(0, 10);
    }
  }

  return {
    tenant,
    leases: enrichedLeases,
    invoices: enrichedInvoices,
    payments: enrichedPayments,
    deposits: enrichedDeposits,
    ledger: (ledger ?? []) as any[],
    activity: (activity ?? []) as any[],
    stats: {
      total_invoiced,
      total_paid,
      outstanding,
      overdue_count,
      current_balance,
      active_leases,
      deposit_held,
      first_move_in_date,
    },
  };
}
