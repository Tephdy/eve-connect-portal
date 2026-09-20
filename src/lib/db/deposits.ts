import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type Deposit = {
  id: string;
  lease_id: string;
  amount: number;
  status: "held" | "partial" | "returned" | "forfeited";
  refunded_amount: number;
  tenant_name?: string;
  unit_number?: string;
};

export async function listDeposits(): Promise<Deposit[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deposit")
    .select("id, lease_id, amount, status, refunded_amount")
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
