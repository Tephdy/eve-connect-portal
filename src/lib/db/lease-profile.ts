import "server-only";
import { createClient } from "@/lib/supabase/server";

export type LeaseInvoiceRow = {
  id: string;
  display_number: string | null;
  type: string;
  amount: number;
  due_date: string;
  status: string;
  created_at: string;
};

export type LeasePaymentRow = {
  id: string;
  invoice_id: string;
  receipt_number: string | null;
  amount: number;
  method: string;
  reference_no: string | null;
  paid_at: string;
  invoice_display: string | null;
};

export type LeaseDepositRow = {
  id: string;
  amount: number;
  status: string;
  refunded_amount: number;
};

export type LeaseProfile = {
  lease: {
    id: string;
    unit_id: string;
    unit_number: string | null;
    property_id: string | null;
    property_name: string | null;
    property_address: string | null;
    tenant_id: string;
    tenant_name: string | null;
    tenant_email: string | null;
    tenant_phone: string | null;
    tenant_messenger_name: string | null;
    tenant_government_id: string | null;
    tenant_status: string | null;
    tenant_since: string | null;
    start_date: string;
    end_date: string;
    move_in_date: string | null;
    due_date: string | null;
    intent: string | null;
    term: string | null;
    monthly_rent: number;
    deposit_amount: number;
    deposit_1: number | null;
    deposit_2: number | null;
    ad_ons: unknown;
    ad_ons_amount: number | null;
    notice_period_days: number;
    status: string;
    created_at: string;
  };
  invoices: LeaseInvoiceRow[];
  payments: LeasePaymentRow[];
  deposits: LeaseDepositRow[];
  contract: {
    id: string;
    status: string;
    signed_at: string | null;
    signed_document_url: string | null;
    tenant_signature_url: string | null;
    template_name: string | null;
  } | null;
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
    paid_count: number;
    unpaid_count: number;
    days_remaining: number;
    days_elapsed: number;
    is_expiring_soon: boolean;
    duration_days: number;
    deposit_held: number;
    deposit_refunded: number;
  };
};

export async function getLeaseProfile(id: string): Promise<LeaseProfile | null> {
  const supabase = await createClient();

  const { data: lease } = await supabase
    .from("lease")
    .select(
      "id, unit_id, unit_number, tenant_id, tenant_name, start_date, end_date, move_in_date, due_date, intent, term, monthly_rent, deposit_amount, deposit_1, deposit_2, ad_ons, ad_ons_amount, notice_period_days, status, created_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (!lease) return null;

  // Unit + property
  const { data: unit } = await supabase
    .from("unit")
    .select("id, property_id, unit_number")
    .eq("id", lease.unit_id)
    .maybeSingle();

  const { data: property } = unit
    ? await supabase
        .from("property")
        .select("id, name, address")
        .eq("id", unit.property_id)
        .maybeSingle()
    : { data: null };

  // Tenant
  const { data: tenant } = await supabase
    .from("tenant")
    .select("id, full_name, email, phone, messenger_name, government_id, status, created_at")
    .eq("id", lease.tenant_id)
    .maybeSingle();

  // Tenant's earliest move-in across all their leases (for "tenant since")
  let tenant_since: string | null = null;
  if (tenant) {
    const { data: tenantLeases } = await supabase
      .from("lease")
      .select("move_in_date, start_date")
      .eq("tenant_id", tenant.id);

    const dates: string[] = [];
    for (const l of tenantLeases ?? []) {
      const d = (l as any).move_in_date ?? (l as any).start_date;
      if (d) dates.push(d);
    }
    if (dates.length > 0) {
      tenant_since = dates.sort()[0];
    } else {
      tenant_since = tenant.created_at.slice(0, 10);
    }
  }

  // Invoices
  const { data: invoices } = await supabase
    .from("invoice")
    .select("id, display_number, type, amount, due_date, status, created_at")
    .eq("lease_id", id)
    .order("due_date", { ascending: false });

  const invoiceRows = (invoices ?? []) as any[];
  const invoiceIds = invoiceRows.map((i) => i.id);
  const invoiceMap = new Map(invoiceRows.map((i) => [i.id, i]));

  // Payments
  let payments: any[] = [];
  if (invoiceIds.length > 0) {
    const { data } = await supabase
      .from("payment")
      .select("id, invoice_id, receipt_number, amount, method, reference_no, paid_at")
      .in("invoice_id", invoiceIds)
      .order("paid_at", { ascending: false });
    payments = data ?? [];
  }

  const enrichedPayments: LeasePaymentRow[] = payments.map((p) => ({
    ...p,
    invoice_display: invoiceMap.get(p.invoice_id)?.display_number ?? null,
  }));

  // Deposits
  const { data: deposits } = await supabase
    .from("deposit")
    .select("id, amount, status, refunded_amount")
    .eq("lease_id", id);

  // Contract
  const { data: contract } = await supabase
    .from("contract")
    .select("id, status, signed_at, signed_document_url, tenant_signature, template_id")
    .eq("lease_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let template_name: string | null = null;
  if (contract?.template_id) {
    const { data: tpl } = await supabase
      .from("contract_template")
      .select("name")
      .eq("id", contract.template_id)
      .maybeSingle();
    template_name = tpl?.name ?? null;
  }

  // Activity
  const entityIds = [id, ...invoiceIds, ...payments.map((p: any) => p.id)];
  const { data: activity } = entityIds.length > 0
    ? await supabase
        .from("audit_log")
        .select("id, action, entity_type, entity_id, created_at, reason")
        .in("entity_id", entityIds)
        .order("created_at", { ascending: false })
        .limit(50)
    : { data: [] as any[] };

  // Stats
  const total_invoiced = invoiceRows.reduce((s, i) => s + Number(i.amount ?? 0), 0);
  const total_paid = payments.reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const outstanding = invoiceRows
    .filter((i) => i.status === "unpaid" || i.status === "overdue")
    .reduce((s, i) => s + Number(i.amount ?? 0), 0);
  const overdue_count = invoiceRows.filter((i) => i.status === "overdue").length;
  const paid_count = invoiceRows.filter((i) => i.status === "paid").length;
  const unpaid_count = invoiceRows.filter((i) => i.status === "unpaid").length;

  const days_remaining = Math.ceil(
    (new Date(lease.end_date).getTime() - Date.now()) / 86400000
  );
  const days_elapsed = Math.ceil(
    (Date.now() - new Date(lease.start_date).getTime()) / 86400000
  );
  const duration_days = Math.max(
    0,
    Math.ceil((new Date(lease.end_date).getTime() - new Date(lease.start_date).getTime()) / 86400000)
  );

  const deposit_held = (deposits ?? [])
    .filter((d: any) => d.status === "held" || d.status === "partial")
    .reduce((s: number, d: any) => s + Number(d.amount ?? 0), 0);
  const deposit_refunded = (deposits ?? []).reduce(
    (s: number, d: any) => s + Number(d.refunded_amount ?? 0),
    0
  );

  return {
    lease: {
      ...lease,
      property_id: unit?.property_id ?? null,
      property_name: property?.name ?? null,
      property_address: property?.address ?? null,
      tenant_email: tenant?.email ?? null,
      tenant_phone: tenant?.phone ?? null,
      tenant_messenger_name: tenant?.messenger_name ?? null,
      tenant_government_id: tenant?.government_id ?? null,
      tenant_status: tenant?.status ?? null,
      tenant_since,
    },
    invoices: invoiceRows as LeaseInvoiceRow[],
    payments: enrichedPayments,
    deposits: (deposits ?? []) as LeaseDepositRow[],
    contract: contract
      ? {
          id: contract.id,
          status: contract.status,
          signed_at: contract.signed_at,
          signed_document_url: contract.signed_document_url,
          tenant_signature_url: contract.tenant_signature,
          template_name,
        }
      : null,
    activity: (activity ?? []) as any[],
    stats: {
      total_invoiced,
      total_paid,
      outstanding,
      overdue_count,
      paid_count,
      unpaid_count,
      days_remaining,
      days_elapsed,
      is_expiring_soon: days_remaining <= 30 && days_remaining >= 0,
      duration_days,
      deposit_held,
      deposit_refunded,
    },
  };
}
