"use server";
// @@CONTRACT_ENGINE:reservation-sign-page-action
import { revalidatePath } from "next/cache";
import { assertPermission } from "@/lib/auth/guard";
import { getSession } from "@/lib/auth/get-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit/log";

export async function signReservationContractAction(input: {
  contract_id: string;
  reservation_id: string;
  signature_data_url: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  await assertPermission("unit:read");
  const session = await getSession();
  const admin = createAdminClient();

  const { data: contract } = await admin
    .schema("prep")
    .from("reservation_contract")
    .select("id, reservation_id, status")
    .eq("id", input.contract_id)
    .maybeSingle();

  if (!contract) return { ok: false, error: "Contract not found" };
  if (contract.reservation_id !== input.reservation_id)
    return { ok: false, error: "Contract does not match reservation" };
  if (contract.status === "signed")
    return { ok: false, error: "Already signed" };

  const { error: upErr } = await admin
    .schema("prep")
    .from("reservation_contract")
    .update({
      status: "signed",
      signed_at: new Date().toISOString(),
      tenant_signature: input.signature_data_url,
    })
    .eq("id", input.contract_id);

  if (upErr) return { ok: false, error: upErr.message };

  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "reservation_contract",
    entity_id: input.contract_id,
    action: "update",
    after: { reservation_id: input.reservation_id },
  });

  revalidatePath("/marketing/reservations/" + input.reservation_id);
  return { ok: true };
}
