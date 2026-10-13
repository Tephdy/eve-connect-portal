"use server";
// @@CONTRACT_ENGINE:sign-action
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireTenantSelf } from "@/lib/auth/require-tenant-self";

export async function signContractAction(input: {
  contract_id: string;
  lease_id: string;
  signature_data_url: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { tenant } = await requireTenantSelf();
  const supabase = await createClient();

  const { data: contract } = await supabase
    .schema("prep")
    .from("contract")
    .select("id, lease_id, status")
    .eq("id", input.contract_id)
    .maybeSingle();

  if (!contract) return { ok: false, error: "Contract not found." };
  if (contract.lease_id !== input.lease_id)
    return { ok: false, error: "Contract does not match lease." };
  if (contract.status === "signed")
    return { ok: false, error: "Contract is already signed." };

  const { data: lease } = await supabase
    .schema("core")
    .from("lease")
    .select("id, tenant_id")
    .eq("id", contract.lease_id)
    .maybeSingle();

  if (!lease || lease.tenant_id !== tenant.id)
    return { ok: false, error: "Not authorized." };

  const { error: upErr } = await supabase
    .schema("prep")
    .from("contract")
    .update({
      status: "signed",
      signed_at: new Date().toISOString(),
      tenant_signature: input.signature_data_url,
    })
    .eq("id", input.contract_id);

  if (upErr) return { ok: false, error: upErr.message };

  revalidatePath("/portal/lease/" + input.lease_id);
  return { ok: true };
}
