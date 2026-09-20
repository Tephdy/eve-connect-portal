import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function onLeaseSigned(payload: {
  lease_id: string;
  contract_id: string;
  signed_at: string;
}) {
  const admin = createAdminClient();

  const { data: lease } = await admin
    .from("lease")
    .select("id, unit_id, tenant_id, start_date, end_date, monthly_rent, deposit_amount")
    .eq("id", payload.lease_id)
    .single();

  if (!lease) return;

  await admin.from("lease").update({ status: "active" }).eq("id", lease.id);
  await admin.from("unit").update({ status: "occupied" }).eq("id", lease.unit_id);

  if (Number(lease.deposit_amount) > 0) {
    await admin.from("invoice").insert({
      lease_id: lease.id,
      type: "deposit",
      amount: lease.deposit_amount,
      due_date: lease.start_date,
      status: "unpaid",
    });

    await admin.from("deposit").insert({
      lease_id: lease.id,
      amount: lease.deposit_amount,
      status: "held",
      refunded_amount: 0,
    });
  }

  await admin.from("invoice").insert({
    lease_id: lease.id,
    type: "rent",
    amount: lease.monthly_rent,
    due_date: lease.start_date,
    status: "unpaid",
  });
}
