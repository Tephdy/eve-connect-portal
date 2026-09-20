import "server-only";
import { createClient } from "@/lib/supabase/server";

export type LedgerEntry = {
  id: string;
  tenant_id: string;
  type: "debit" | "credit";
  amount: number;
  balance_after: number;
  ref_invoice_id: string | null;
  created_at: string;
};

export async function listLedgerForTenant(tenant_id: string): Promise<LedgerEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ledger_entry")
    .select("id, tenant_id, type, amount, balance_after, ref_invoice_id, created_at")
    .eq("tenant_id", tenant_id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as LedgerEntry[];
}

export async function appendLedgerEntry(input: {
  tenant_id: string;
  type: "debit" | "credit";
  amount: number;
  ref_invoice_id: string | null;
}): Promise<void> {
  const supabase = await createClient();
  // Get current balance
  const { data: last } = await supabase
    .from("ledger_entry")
    .select("balance_after")
    .eq("tenant_id", input.tenant_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const prev = last ? Number(last.balance_after) : 0;
  const delta = input.type === "debit" ? input.amount : -input.amount;
  const balance_after = prev + delta;

  const { error } = await supabase.from("ledger_entry").insert({
    tenant_id: input.tenant_id,
    type: input.type,
    amount: input.amount,
    balance_after,
    ref_invoice_id: input.ref_invoice_id,
  });
  if (error) throw new Error(error.message);
}
