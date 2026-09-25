import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type Deposit = {
  id: string;
  lease_id: string;
  amount: number;
  status: "held" | "partial" | "returned" | "forfeited";
  refunded_amount: number;
  invoice_id: string | null;
  paid_amount: number;
  tenant_name?: string;
  unit_number?: string;
};

export async function listDeposits(): Promise<Deposit[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deposit")
    .select("id, lease_id, amount, status, refunded_amount, invoice_id, paid_amount")
    .order("id", { ascending: false });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Deposit[];
  if (rows.length === 0) return rows;

  const leaseIds = Array.from(new Set(rows.map((d) => d.lease_id)));
  const { data: leases } = await supabase
    .from("lease").select("id, tenant_id, unit_id").in("id", leaseIds);

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

  rows.forEach((d) => {
    const l = lMap.get(d.lease_id);
    if (l) {
      d.tenant_name = tMap.get(l.tenant_id);
      d.unit_number = uMap.get(l.unit_id);
    }
  });
  return rows;
}

export async function refundDeposit(
  id: string,
  amount: number,
  forfeit: boolean
): Promise<void> {
  const admin = createAdminClient();
  const status = forfeit ? "forfeited" : amount === 0 ? "forfeited" : "returned";
  const { error } = await admin
    .from("deposit")
    .update({ status, refunded_amount: amount })
    .eq("id", id);
  if (error) throw new Error(error.message);
}


// ---------------------------------------------------------------------------
// Deposit lifecycle — driven by payments landing on deposit-type invoices
// ---------------------------------------------------------------------------

/**
 * One deposit per lease. Called from recordPaymentAction when the
 * invoice's type is "deposit".
 *
 *   - amount     = the invoice amount (how much SHOULD be held)
 *   - paid       = the payment amount (how much WAS paid)
 *   - status     = "held" when fully funded, "partial" otherwise
 *
 * If a deposit row already exists for the lease, we accumulate paid_amount
 * (so a 2nd deposit invoice tops up the same row).
 */
export async function upsertDepositFromPayment(input: {
  lease_id: string;
  invoice_id: string;
  invoice_amount: number;
  payment_amount: number;
}): Promise<void> {
  const admin = createAdminClient();

  const { data: existing } = await admin
    .schema("acct")
    .from("deposit")
    .select("id, amount, paid_amount, status, refunded_amount")
    .eq("lease_id", input.lease_id)
    .maybeSingle();

  const newPaid = Number(existing?.paid_amount ?? 0) + Number(input.payment_amount);
  const targetAmount =
    Number(existing?.amount ?? 0) + Number(input.invoice_amount);

  // If the deposit was already partially refunded, keep the refunded_amount
  // so we don't accidentally mark it as fully held again.
  const alreadyRefunded = Number(existing?.refunded_amount ?? 0);
  const netPaid = Math.max(0, newPaid - alreadyRefunded);

  const status =
    netPaid >= targetAmount
      ? "held"
      : netPaid > 0
      ? "partial"
      : "partial";

  if (existing) {
    await admin
      .schema("acct")
      .from("deposit")
      .update({
        amount: targetAmount,
        paid_amount: newPaid,
        status,
        invoice_id: input.invoice_id,
      })
      .eq("id", existing.id);
  } else {
    await admin
      .schema("acct")
      .from("deposit")
      .insert({
        lease_id: input.lease_id,
        invoice_id: input.invoice_id,
        amount: targetAmount,
        paid_amount: newPaid,
        status,
        refunded_amount: 0,
      });
  }
}
