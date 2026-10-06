import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type MyLeaseSummary = {
  id: string;
  unit_number: string | null;
  property_name: string | null;
  start_date: string;
  end_date: string;
  monthly_rent: number;
  status: string;
  is_active: boolean;
};

export type MyLeaseInvoice = {
  id: string;
  display_number: string | null;
  type: string;
  amount: number;
  due_date: string;
  status: string;
};

export type MyLeasePayment = {
  id: string;
  invoice_id: string;
  receipt_number: string | null;
  amount: number;
  method: string;
  reference_no: string | null;
  paid_at: string;
  invoice_display: string | null;
};

export type MyLeaseDeposit = {
  id: string;
  amount: number;
  status: string;
  refunded_amount: number;
};

export type MyLeaseDetail = {
  lease: {
    id: string;
    unit_id: string;
    unit_number: string | null;
    property_name: string | null;
    property_address: string | null;
    start_date: string;
    end_date: string;
    move_in_date: string | null;
    due_date: string | null;
    term: string | null;
    term_months: number | null;
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
  invoices: MyLeaseInvoice[];
  payments: MyLeasePayment[];
  deposits: MyLeaseDeposit[];
  contract: {
    id: string;
    status: string;
    signed_at: string | null;
    signed_document_url: string | null;
    template_name: string | null;
  } | null;
  stats: {
    total_invoiced: number;
    total_paid: number;
    outstanding: number;
    overdue_count: number;
    days_remaining: number;
    duration_days: number;
    is_expiring_soon: boolean;
    deposit_held: number;
  };
};

export async function listMyLeases(tenantId: string): Promise<MyLeaseSummary[]> {
  const admin = createAdminClient();

  const { data: leases } = await admin
    .schema("core")
    .from("lease")
    .select("id, unit_id, start_date, end_date, monthly_rent, status")
    .eq("tenant_id", tenantId)
    .order("start_date", { ascending: false });

  const rows = (leases ?? []) as any[];
  if (rows.length === 0) return [];

  const unitIds = Array.from(new Set(rows.map((r) => r.unit_id).filter(Boolean)));
  const { data: units } = unitIds.length > 0
    ? await admin.schema("core").from("unit").select("id, unit_number, property_id").in("id", unitIds)
    : { data: [] as any[] };
  const unitMap = new Map((units ?? []).map((u: any) => [u.id, u]));

  const propIds = Array.from(
    new Set((units ?? []).map((u: any) => u.property_id).filter(Boolean))
  );
   const { data: props } = propIds.length > 0
    ? await admin.schema("core").from("property").select("id, name").in("id", propIds)
    : { data: [] as any[] };
  const propMap = new Map<string, string>(
    (props ?? []).map((p: any) => [p.id as string, p.name as string])
  );

    return rows.map((r) => {
    const u: any = unitMap.get(r.unit_id);
    const propName: string | null = u?.property_id
      ? ((propMap.get(u.property_id) as string | undefined) ?? null)
      : null;
    return {
      id: r.id as string,
      unit_number: (u?.unit_number ?? null) as string | null,
      property_name: propName,
      start_date: r.start_date as string,
      end_date: r.end_date as string,
      monthly_rent: Number(r.monthly_rent ?? 0),
      status: r.status as string,
      is_active: r.status === "active" || r.status === "expiring",
    };
  });
}

export async function getMyLease(
  leaseId: string,
  tenantId: string
): Promise<MyLeaseDetail | null> {
  const admin = createAdminClient();

  const { data: lease } = await admin
    .schema("core")
    .from("lease")
    .select(
      "id, unit_id, tenant_id, start_date, end_date, move_in_date, due_date, term, term_months, monthly_rent, deposit_amount, deposit_1, deposit_2, ad_ons, ad_ons_amount, notice_period_days, status, created_at"
    )
    .eq("id", leaseId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!lease) return null;

  const { data: unit } = await admin
    .schema("core")
    .from("unit")
    .select("id, unit_number, property_id")
    .eq("id", (lease as any).unit_id)
    .maybeSingle();

  const { data: property } = unit?.property_id
    ? await admin.schema("core").from("property").select("id, name, address").eq("id", unit.property_id).maybeSingle()
    : { data: null };

  const { data: invoiceRows } = await admin
    .schema("acct")
    .from("invoice")
    .select("id, display_number, type, amount, due_date, status")
    .eq("lease_id", leaseId)
    .order("due_date", { ascending: false });

  const invoiceList = (invoiceRows ?? []) as any[];
  const invoiceIds = invoiceList.map((i) => i.id);
  const invoiceMap = new Map(invoiceList.map((i) => [i.id, i]));

  let payments: any[] = [];
  if (invoiceIds.length > 0) {
    const { data } = await admin
      .schema("acct")
      .from("payment")
      .select("id, invoice_id, receipt_number, amount, method, reference_no, paid_at")
      .in("invoice_id", invoiceIds)
      .order("paid_at", { ascending: false });
    payments = data ?? [];
  }

  const { data: deposits } = await admin
    .schema("acct")
    .from("deposit")
    .select("id, amount, status, refunded_amount")
    .eq("lease_id", leaseId);

  const { data: contract } = await admin
    .schema("prep")
    .from("contract")
    .select("id, status, signed_at, signed_document_url, template_id")
    .eq("lease_id", leaseId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let template_name: string | null = null;
  if (contract?.template_id) {
    const { data: tpl } = await admin
      .schema("prep")
      .from("contract_template")
      .select("name")
      .eq("id", contract.template_id)
      .maybeSingle();
    template_name = (tpl as { name: string } | null)?.name ?? null;
  }

  const total_invoiced = invoiceList.reduce((s, i) => s + Number(i.amount ?? 0), 0);
  const total_paid = payments.reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const outstanding = invoiceList
    .filter((i) => i.status === "unpaid" || i.status === "overdue")
    .reduce((s, i) => s + Number(i.amount ?? 0), 0);
  const overdue_count = invoiceList.filter((i) => i.status === "overdue").length;
  const days_remaining = Math.ceil(
    (new Date((lease as any).end_date).getTime() - Date.now()) / 86400000
  );
  const duration_days = Math.max(
    0,
    Math.ceil(
      (new Date((lease as any).end_date).getTime() -
        new Date((lease as any).start_date).getTime()) /
        86400000
    )
  );
  const deposit_held = (deposits ?? [])
    .filter((d: any) => d.status === "held" || d.status === "partial")
    .reduce((s: number, d: any) => s + Number(d.amount ?? 0), 0);

  return {
    lease: {
      id: (lease as any).id,
      unit_id: (lease as any).unit_id,
      unit_number: unit?.unit_number ?? null,
      property_name: (property as any)?.name ?? null,
      property_address: (property as any)?.address ?? null,
      start_date: (lease as any).start_date,
      end_date: (lease as any).end_date,
      move_in_date: (lease as any).move_in_date,
      due_date: (lease as any).due_date,
      term: (lease as any).term,
      term_months: (lease as any).term_months,
      monthly_rent: Number((lease as any).monthly_rent ?? 0),
      deposit_amount: Number((lease as any).deposit_amount ?? 0),
      deposit_1: (lease as any).deposit_1,
      deposit_2: (lease as any).deposit_2,
      ad_ons: (lease as any).ad_ons,
      ad_ons_amount: (lease as any).ad_ons_amount,
      notice_period_days: (lease as any).notice_period_days,
      status: (lease as any).status,
      created_at: (lease as any).created_at,
    },
    invoices: invoiceList as MyLeaseInvoice[],
    payments: payments.map((p) => ({
      ...p,
      invoice_display: invoiceMap.get(p.invoice_id)?.display_number ?? null,
    })),
    deposits: (deposits ?? []) as MyLeaseDeposit[],
    contract: contract
      ? {
          id: (contract as any).id,
          status: (contract as any).status,
          signed_at: (contract as any).signed_at,
          signed_document_url: (contract as any).signed_document_url,
          template_name,
        }
      : null,
    stats: {
      total_invoiced,
      total_paid,
      outstanding,
      overdue_count,
      days_remaining,
      duration_days,
      is_expiring_soon: days_remaining <= 30 && days_remaining >= 0,
      deposit_held,
    },
  };
}


// ---- PROFILE EDIT (added by apply-chunk-5) ----

import type { InspectionUpdateInput } from "@/lib/schemas/tenant-profile";

export async function updateMyProfile(
  tenantId: string,
  patch: {
    first_name: string;
    middle_name?: string | null;
    last_name: string;
    birth_date?: string | null;
    gender?: string | null;
    nationality?: string | null;
    religion?: string | null;
    civil_status?: string | null;
    permanent_address?: string | null;
    recent_address?: string | null;
    phone: string;
    messenger_name?: string | null;
    email: string;
    company?: string | null;
    work_status?: string | null;
    work_position?: string | null;
    company_address?: string | null;
    company_tel?: string | null;
    company_email?: string | null;
    company_messenger?: string | null;
    marketing_source?: string | null;
    ec1_name: string;
    ec1_phone: string;
    ec1_email?: string | null;
    ec1_messenger?: string | null;
    ec2_name?: string | null;
    ec2_phone?: string | null;
    ec2_email?: string | null;
    ec2_messenger?: string | null;
  }
): Promise<void> {
  const admin = createAdminClient();

  const full_name = [patch.first_name, patch.middle_name, patch.last_name]
    .filter((s) => s && s.trim())
    .join(" ");

  const { error } = await admin
    .schema("core")
    .from("tenant")
    .update({
      first_name: patch.first_name,
      middle_name: patch.middle_name || null,
      last_name: patch.last_name,
      full_name,
      birth_date: patch.birth_date || null,
      gender: patch.gender || null,
      nationality: patch.nationality || null,
      religion: patch.religion || null,
      civil_status: patch.civil_status || null,
      permanent_address: patch.permanent_address || null,
      recent_address: patch.recent_address || null,
      phone: patch.phone,
      messenger_name: patch.messenger_name || null,
      email: patch.email,
      company: patch.company || null,
      work_status: patch.work_status || null,
      work_position: patch.work_position || null,
      company_address: patch.company_address || null,
      company_tel: patch.company_tel || null,
      company_email: patch.company_email || null,
      company_messenger: patch.company_messenger || null,
      marketing_source: patch.marketing_source || null,
      ec1_name: patch.ec1_name,
      ec1_phone: patch.ec1_phone,
      ec1_email: patch.ec1_email || null,
      ec1_messenger: patch.ec1_messenger || null,
      ec2_name: patch.ec2_name || null,
      ec2_phone: patch.ec2_phone || null,
      ec2_email: patch.ec2_email || null,
      ec2_messenger: patch.ec2_messenger || null,
    })
    .eq("id", tenantId);

  if (error) throw new Error(error.message);
}

export type UnitInspection = {
  id: string;
  lease_id: string;
  switches: string | null;
  switches_comment: string | null;
  sockets: string | null;
  sockets_comment: string | null;
  cabinet: string | null;
  cabinet_comment: string | null;
  lavatory: string | null;
  lavatory_comment: string | null;
  light_bulb: string | null;
  light_bulb_comment: string | null;
  faucets: string | null;
  faucets_comment: string | null;
  shower_head: string | null;
  shower_head_comment: string | null;
  declogging: string | null;
  declogging_comment: string | null;
  toilet_bowl: string | null;
  toilet_bowl_comment: string | null;
  kitchen_sink: string | null;
  kitchen_sink_comment: string | null;
  wall_paint: string | null;
  wall_paint_comment: string | null;
  optional_items: string | null;
  optional_items_comment: string | null;
  door: string | null;
  door_comment: string | null;
  number_of_persons: number | null;
  filled_by_tenant_at: string | null;
  filled_by_staff_at: string | null;
  filled_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

export async function getMyInspection(
  leaseId: string,
  tenantId: string
): Promise<UnitInspection | null> {
  const admin = createAdminClient();

  const { data: lease } = await admin
    .schema("core")
    .from("lease")
    .select("id")
    .eq("id", leaseId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!lease) return null;

  const { data } = await admin
    .schema("prep")
    .from("unit_inspection")
    .select("*")
    .eq("lease_id", leaseId)
    .maybeSingle();

  return (data as UnitInspection) ?? null;
}

export async function upsertMyInspection(input: {
  tenantId: string;
  leaseId: string;
  userId: string;
  patch: Omit<InspectionUpdateInput, "lease_id">;
}): Promise<void> {
  const admin = createAdminClient();

  const { data: lease } = await admin
    .schema("core")
    .from("lease")
    .select("id")
    .eq("id", input.leaseId)
    .eq("tenant_id", input.tenantId)
    .maybeSingle();

  if (!lease) throw new Error("Lease not found for this tenant");

  const { data: existing } = await admin
    .schema("prep")
    .from("unit_inspection")
    .select("id")
    .eq("lease_id", input.leaseId)
    .maybeSingle();

  const now = new Date().toISOString();

  const payload = {
    lease_id: input.leaseId,
    switches: input.patch.switches || null,
    switches_comment: input.patch.switches_comment || null,
    sockets: input.patch.sockets || null,
    sockets_comment: input.patch.sockets_comment || null,
    cabinet: input.patch.cabinet || null,
    cabinet_comment: input.patch.cabinet_comment || null,
    lavatory: input.patch.lavatory || null,
    lavatory_comment: input.patch.lavatory_comment || null,
    light_bulb: input.patch.light_bulb || null,
    light_bulb_comment: input.patch.light_bulb_comment || null,
    faucets: input.patch.faucets || null,
    faucets_comment: input.patch.faucets_comment || null,
    shower_head: input.patch.shower_head || null,
    shower_head_comment: input.patch.shower_head_comment || null,
    declogging: input.patch.declogging || null,
    declogging_comment: input.patch.declogging_comment || null,
    toilet_bowl: input.patch.toilet_bowl || null,
    toilet_bowl_comment: input.patch.toilet_bowl_comment || null,
    kitchen_sink: input.patch.kitchen_sink || null,
    kitchen_sink_comment: input.patch.kitchen_sink_comment || null,
    wall_paint: input.patch.wall_paint || null,
    wall_paint_comment: input.patch.wall_paint_comment || null,
    optional_items: input.patch.optional_items || null,
    optional_items_comment: input.patch.optional_items_comment || null,
    door: input.patch.door || null,
    door_comment: input.patch.door_comment || null,
    number_of_persons: input.patch.number_of_persons,
    filled_by_tenant_at: now,
    filled_by_user_id: input.userId,
    updated_at: now,
  };

  if (existing) {
    const { error } = await admin
      .schema("prep")
      .from("unit_inspection")
      .update(payload)
      .eq("id", (existing as { id: string }).id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await admin
      .schema("prep")
      .from("unit_inspection")
      .insert(payload);
    if (error) throw new Error(error.message);
  }
}
