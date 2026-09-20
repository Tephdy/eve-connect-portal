import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { InvoiceCreateInput } from "@/lib/schemas/invoice";

export type Invoice = {
  id: string;
  lease_id: string;
  type: "rent" | "deposit" | "penalty" | "other";
  amount: number;
  due_date: string;
  status: "unpaid" | "paid" | "overdue" | "void";
  created_at: string;
  display_number: string | null;
  tenant_name?: string;
  unit_number?: string;
  paid_amount?: number;
};

const INVOICE_SELECT =
  "id, lease_id, type, amount, due_date, status, created_at, display_number";

async function enrich(rows: Invoice[]): Promise<Invoice[]> {
  if (rows.length === 0) return rows;
  const supabase = await createClient();
  const leaseIds = Array.from(new Set(rows.map((r) => r.lease_id)));

  const { data: leases } = await supabase
    .from("lease")
    .select("id, tenant_id, unit_id")
    .in("id", leaseIds);

  const tenantIds = Array.from(new Set((leases ?? []).map((l) => l.tenant_id)));
  const unitIds   = Array.from(new Set((leases ?? []).map((l) => l.unit_id)));

  const [{ data: tenants }, { data: units }] = await Promise.all([
    tenantIds.length > 0
      ? supabase.from("tenant").select("id, full_name").in("id", tenantIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    unitIds.length > 0
      ? supabase.from("unit").select("id, unit_number").in("id", unitIds)
      : Promise.resolve({ data: [] as { id: string; unit_number: string }[] }),
  ]);

  const lMap = new Map((leases ?? []).map((l) => [l.id, l]));
  const tMap = new Map((tenants ?? []).map((t) => [t.id, t.full_name]));
  const uMap = new Map((units ?? []).map((u) => [u.id, u.unit_number]));

  rows.forEach((r) => {
    const l = lMap.get(r.lease_id);
    if (l) {
      r.tenant_name = tMap.get(l.tenant_id);
      r.unit_number = uMap.get(l.unit_id);
    }
  });
  return rows;
}

export async function listInvoices(filter?: "all" | "unpaid" | "overdue" | "paid"): Promise<Invoice[]> {
  const supabase = await createClient();
  let q = supabase
    .from("invoice")
    .select(INVOICE_SELECT)
    .order("created_at", { ascending: false });

  if (filter === "unpaid")  q = q.in("status", ["unpaid", "overdue"]);
  if (filter === "overdue") q = q.eq("status", "overdue");
  if (filter === "paid")    q = q.eq("status", "paid");

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return enrich((data ?? []) as Invoice[]);
}

export async function getInvoice(id: string): Promise<Invoice | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoice")
    .select(INVOICE_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const [enriched] = await enrich([data as Invoice]);
  return enriched;
}

function logWriteError(fn: string, error: unknown) {
  const safe = error instanceof Error ? error.message : JSON.stringify(error, null, 2);
  // eslint-disable-next-line no-console
  console.error("[" + fn + "]", safe);
}

export async function createInvoice(input: InvoiceCreateInput): Promise<Invoice> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("invoice")
    .insert({
      lease_id: input.lease_id,
      type: input.type,
      amount: input.amount,
      due_date: input.due_date,
      status: "unpaid",
    })
    .select(INVOICE_SELECT)
    .single();
  if (error) { logWriteError("createInvoice", error); throw new Error(error.message); }
  return data as Invoice;
}

export async function markInvoicePaid(id: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("invoice").update({ status: "paid" }).eq("id", id);
  if (error) { logWriteError("markInvoicePaid", error); throw new Error(error.message); }
}

export async function voidInvoice(id: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("invoice").update({ status: "void" }).eq("id", id);
  if (error) { logWriteError("voidInvoice", error); throw new Error(error.message); }
}

export async function listOverdueInvoices(): Promise<Invoice[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoice")
    .select(INVOICE_SELECT)
    .eq("status", "unpaid")
    .lt("due_date", new Date().toISOString().slice(0, 10))
    .order("due_date", { ascending: true });
  if (error) throw new Error(error.message);
  return enrich((data ?? []) as Invoice[]);
}

export async function dashboardStats(): Promise<{
  outstanding: number;
  collected_this_month: number;
  overdue_count: number;
  due_this_week: number;
}> {
  const supabase = await createClient();
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const weekAhead = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const todayStr = today.toISOString().slice(0, 10);

  const [{ data: unpaid }, { data: paid }, { data: overdue }, { data: dueWeek }] = await Promise.all([
    supabase.from("invoice").select("amount").in("status", ["unpaid","overdue"]),
    supabase.from("payment").select("amount").gte("paid_at", monthStart),
    supabase.from("invoice").select("id").eq("status", "overdue"),
    supabase.from("invoice").select("id").in("status", ["unpaid","overdue"])
      .gte("due_date", todayStr).lte("due_date", weekAhead),
  ]);

  return {
    outstanding: (unpaid ?? []).reduce((s, r: any) => s + Number(r.amount), 0),
    collected_this_month: (paid ?? []).reduce((s, r: any) => s + Number(r.amount), 0),
    overdue_count: (overdue ?? []).length,
    due_this_week: (dueWeek ?? []).length,
  };
}
