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
  tenant_id: string | null;
  invoice_display?: string;
  invoice_type?: string;
  tenant_name?: string;
  reservation_client_name?: string;
  reservation_unit_number?: string;
  reservation_property_name?: string;
};

export async function listPayments(): Promise<Payment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payment")
    .select("id, invoice_id, amount, method, reference_no, paid_at, recorded_by, receipt_number, tenant_id")
    .order("paid_at", { ascending: false });
  if (error) throw new Error(error.message);

  const payments = (data ?? []) as Payment[];
  if (payments.length === 0) return payments;

  const invIds = Array.from(new Set(payments.map((p) => p.invoice_id)));
  const { data: invoices } = await supabase
    .from("invoice").select("id, display_number, lease_id, type, reservation_id, tenant_id").in("id", invIds);
  const invMap = new Map((invoices ?? []).map((i: any) => [i.id, i]));

  const leaseIds = Array.from(new Set((invoices ?? []).map((i: any) => i.lease_id)));
  const { data: leases } = leaseIds.length > 0
    ? await supabase.from("lease").select("id, tenant_id").in("id", leaseIds)
    : { data: [] as { id: string; tenant_id: string }[] };

  const invTenantIds = (invoices ?? []).map((i: any) => i.tenant_id).filter(Boolean);
  const leaseTenantIds = (leases ?? []).map((l) => l.tenant_id).filter(Boolean);
  const tenantIds = Array.from(new Set([...invTenantIds, ...leaseTenantIds]));
  const { data: tenants } = tenantIds.length > 0
    ? await supabase.from("tenant").select("id, full_name").in("id", tenantIds)
    : { data: [] as { id: string; full_name: string }[] };

  const lMap = new Map((leases ?? []).map((l) => [l.id, l]));
  const resIds = Array.from(
    new Set(
      (invoices ?? [])
        .map((i: any) => i.reservation_id)
        .filter(Boolean)
    )
  );
  const { data: reservations } = resIds.length > 0
    ? await supabase
        .schema("acct")
        .from("unit_reservation")
        .select("id, client_name, unit_id")
        .in("id", resIds)
    : { data: [] as any[] };
  const rMap = new Map((reservations ?? []).map((r: any) => [r.id, r]));

  const rUnitIds = Array.from(
    new Set((reservations ?? []).map((r: any) => r.unit_id).filter(Boolean))
  );
  const { data: rUnits } = rUnitIds.length > 0
    ? await supabase
        .from("unit")
        .select("id, unit_number, property_id")
        .in("id", rUnitIds)
    : { data: [] as any[] };
  const rUnitMap = new Map((rUnits ?? []).map((u: any) => [u.id, u]));

  const rPropIds = Array.from(
    new Set((rUnits ?? []).map((u: any) => u.property_id).filter(Boolean))
  );
  const { data: rProps } = rPropIds.length > 0
    ? await supabase.from("property").select("id, name").in("id", rPropIds)
    : { data: [] as any[] };
  const rPropMap = new Map((rProps ?? []).map((pp: any) => [pp.id, pp.name]));
  const tMap = new Map((tenants ?? []).map((t) => [t.id, t.full_name]));

  payments.forEach((p) => {
    const inv = invMap.get(p.invoice_id);
    p.invoice_display = inv?.display_number ?? undefined;
    p.invoice_type = inv?.type ?? undefined;

    // Preferred: invoice.tenant_id (works even if the lease was deleted)
    const directTenantId = (inv as any)?.tenant_id ?? null;
    // Fallback: walk the lease
    const viaLeaseId =
      inv?.lease_id && lMap.get(inv.lease_id)
        ? (lMap.get(inv.lease_id) as any).tenant_id
        : null;
    const tenantId = directTenantId ?? viaLeaseId;

    if (tenantId) {
      p.tenant_name = tMap.get(tenantId);
    }

    // Fallback: reservation-only (no tenant yet)
    if (!p.tenant_name && (inv as any)?.reservation_id) {
      const res: any = rMap.get((inv as any).reservation_id);
      if (res) {
        p.tenant_name = res.client_name;
        p.reservation_client_name = res.client_name;
        const u: any = res.unit_id ? rUnitMap.get(res.unit_id) : null;
        if (u) {
          p.reservation_unit_number = u.unit_number;
          p.reservation_property_name = u.property_id
            ? rPropMap.get(u.property_id)
            : undefined;
        }
      }
    }
  });

  return payments;
}

export async function listPaymentsForInvoice(invoice_id: string): Promise<Payment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payment")
    .select("id, invoice_id, amount, method, reference_no, paid_at, recorded_by, receipt_number, tenant_id")
    .eq("invoice_id", invoice_id)
    .order("paid_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Payment[];
}

export async function getPayment(id: string): Promise<Payment | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payment")
    .select("id, invoice_id, amount, method, reference_no, paid_at, recorded_by, receipt_number, tenant_id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Payment) ?? null;
}

export async function recordPayment(
  input: PaymentCreateInput & { recorded_by: string | null }
): Promise<Payment> {
  const admin = createAdminClient();

  // Resolve the tenant from the invoice so the payment carries the same
  // tenant_id (needed by the tenant profile's payments aggregation).
  let tenant_id: string | null = null;
  try {
    const { data: inv } = await admin
      .schema("acct")
      .from("invoice")
      .select("tenant_id")
      .eq("id", input.invoice_id)
      .maybeSingle();
    tenant_id = (inv as any)?.tenant_id ?? null;
  } catch (err) {
    console.error("[recordPayment] tenant lookup failed:", err);
  }

  const { data, error } = await admin
    .from("payment")
    .insert({
      invoice_id: input.invoice_id,
      amount: input.amount,
      method: input.method,
      reference_no: input.reference_no || null,
      recorded_by: input.recorded_by,
      tenant_id,
    })
    .select("id, invoice_id, amount, method, reference_no, paid_at, recorded_by, receipt_number, tenant_id")
    .single();
  if (error) {
    console.error("[recordPayment]", JSON.stringify(error, null, 2));
    throw new Error(error.message);
  }
  return data as Payment;
}
