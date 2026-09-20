import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PaymentCreateInput } from "@/lib/schemas/invoice";

export type Payment = {
  id: string;
  invoice_id: string;
  amount: number;
  method: string;
  reference_no: string | null;
  paid_at: string;
  recorded_by: string | null;
  receipt_number: string | null;
  invoice_display?: string;
  tenant_name?: string;
};

export async function listPayments(): Promise<Payment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payment")
    .select("id, invoice_id, amount, method, reference_no, paid_at, recorded_by, receipt_number")
    .order("paid_at", { ascending: false });
  if (error) throw new Error(error.message);

  const payments = (data ?? []) as Payment[];
  if (payments.length === 0) return payments;

  const invIds = Array.from(new Set(payments.map((p) => p.invoice_id)));
  const { data: invoices } = await supabase
    .from("invoice").select("id, display_number, lease_id").in("id", invIds);
  const invMap = new Map((invoices ?? []).map((i: any) => [i.id, i]));

  const leaseIds = Array.from(new Set((invoices ?? []).map((i: any) => i.lease_id)));
  const { data: leases } = leaseIds.length > 0
    ? await supabase.from("lease").select("id, tenant_id").in("id", leaseIds)
    : { data: [] as { id: string; tenant_id: string }[] };

  const tenantIds = Array.from(new Set((leases ?? []).map((l) => l.tenant_id)));
  const { data: tenants } = tenantIds.length > 0
    ? await supabase.from("tenant").select("id, full_name").in("id", tenantIds)
    : { data: [] as { id: string; full_name: string }[] };

  const lMap = new Map((leases ?? []).map((l) => [l.id, l]));
  const tMap = new Map((tenants ?? []).map((t) => [t.id, t.full_name]));

  payments.forEach((p) => {
    const inv = invMap.get(p.invoice_id);
    p.invoice_display = inv?.display_number ?? undefined;
    const l = inv ? lMap.get(inv.lease_id) : null;
    p.tenant_name = l ? tMap.get(l.tenant_id) : undefined;
  });

  return payments;
}

export async function listPaymentsForInvoice(invoice_id: string): Promise<Payment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payment")
    .select("id, invoice_id, amount, method, reference_no, paid_at, recorded_by, receipt_number")
    .eq("invoice_id", invoice_id)
    .order("paid_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Payment[];
}

export async function getPayment(id: string): Promise<Payment | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payment")
    .select("id, invoice_id, amount, method, reference_no, paid_at, recorded_by, receipt_number")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Payment) ?? null;
}

export async function recordPayment(
  input: PaymentCreateInput & { recorded_by: string | null }
): Promise<Payment> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("payment")
    .insert({
      invoice_id: input.invoice_id,
      amount: input.amount,
      method: input.method,
      reference_no: input.reference_no || null,
      recorded_by: input.recorded_by,
    })
    .select("id, invoice_id, amount, method, reference_no, paid_at, recorded_by, receipt_number")
    .single();
  if (error) {
    console.error("[recordPayment]", JSON.stringify(error, null, 2));
    throw new Error(error.message);
  }
  return data as Payment;
}
