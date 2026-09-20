import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function onInvoicePaid(payload: {
  payment_id: string;
  invoice_id: string;
  amount: number;
}) {
  const admin = createAdminClient();

  const { data: invoice } = await admin
    .from("invoice")
    .select("id, lease_id")
    .eq("id", payload.invoice_id)
    .single();
  if (!invoice) return;

  const { data: lease } = await admin
    .from("lease")
    .select("tenant_id")
    .eq("id", invoice.lease_id)
    .single();
  if (!lease) return;

  const { data: last } = await admin
    .from("ledger_entry")
    .select("balance_after")
    .eq("tenant_id", lease.tenant_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const prev = last ? Number(last.balance_after) : 0;
  const balance_after = prev - Number(payload.amount);

  await admin.from("ledger_entry").insert({
    tenant_id: lease.tenant_id,
    type: "credit",
    amount: payload.amount,
    balance_after,
    ref_invoice_id: payload.invoice_id,
  });
}
