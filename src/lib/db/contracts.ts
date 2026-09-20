import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Contract = {
  id: string;
  lease_id: string;
  template_id: string | null;
  generated_body: string | null;
  status: "draft" | "sent" | "signed" | "void";
  signed_at: string | null;
  signed_document_url: string | null;
  tenant_signature: string | null;
  created_at: string;
  template_name?: string;
  tenant_name?: string;
  unit_number?: string;
};

async function enrich(rows: Contract[]): Promise<Contract[]> {
  if (rows.length === 0) return rows;
  const supabase = await createClient();

  const leaseIds = Array.from(new Set(rows.map((c) => c.lease_id)));
  const tplIds = Array.from(new Set(rows.map((c) => c.template_id).filter(Boolean))) as string[];

  const [{ data: leases }, { data: templates }] = await Promise.all([
    supabase.from("lease").select("id, tenant_id, unit_id").in("id", leaseIds),
    tplIds.length > 0
      ? supabase.from("contract_template").select("id, name").in("id", tplIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const tenantIds = Array.from(new Set((leases ?? []).map((l) => l.tenant_id)));
  const unitIds = Array.from(new Set((leases ?? []).map((l) => l.unit_id)));

  const [{ data: tenants }, { data: units }] = await Promise.all([
    tenantIds.length > 0
      ? supabase.from("tenant").select("id, full_name").in("id", tenantIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    unitIds.length > 0
      ? supabase.from("unit").select("id, unit_number").in("id", unitIds)
      : Promise.resolve({ data: [] as { id: string; unit_number: string }[] }),
  ]);

  const leaseMap = new Map((leases ?? []).map((l) => [l.id, l]));
  const tplMap = new Map((templates ?? []).map((t) => [t.id, t.name]));
  const tenMap = new Map((tenants ?? []).map((t) => [t.id, t.full_name]));
  const unitMap = new Map((units ?? []).map((u) => [u.id, u.unit_number]));

  rows.forEach((c) => {
    c.template_name = c.template_id ? tplMap.get(c.template_id) : undefined;
    const lease = leaseMap.get(c.lease_id);
    if (lease) {
      c.tenant_name = tenMap.get(lease.tenant_id);
      c.unit_number = unitMap.get(lease.unit_id);
    }
  });
  return rows;
}

export async function listContracts(): Promise<Contract[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contract")
    .select("id, lease_id, template_id, generated_body, status, signed_at, signed_document_url, tenant_signature, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return enrich((data ?? []) as Contract[]);
}

export async function getContract(id: string): Promise<Contract | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contract")
    .select("id, lease_id, template_id, generated_body, status, signed_at, signed_document_url, tenant_signature, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const [enriched] = await enrich([data as Contract]);
  return enriched;
}

export async function createContractDraft(input: {
  lease_id: string;
  template_id: string;
  generated_body: string;
}): Promise<Contract> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contract")
    .insert({
      lease_id: input.lease_id,
      template_id: input.template_id,
      generated_body: input.generated_body,
      status: "draft",
    })
    .select("id, lease_id, template_id, generated_body, status, signed_at, signed_document_url, tenant_signature, created_at")
    .single();
  if (error) throw new Error(error.message);
  return data as Contract;
}

export async function markContractSigned(input: {
  contract_id: string;
  signature_url: string;
  signed_document_url: string | null;
}): Promise<Contract> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contract")
    .update({
      status: "signed",
      signed_at: new Date().toISOString(),
      tenant_signature: input.signature_url,
      signed_document_url: input.signed_document_url,
    })
    .eq("id", input.contract_id)
    .select("id, lease_id, template_id, generated_body, status, signed_at, signed_document_url, tenant_signature, created_at")
    .single();
  if (error) throw new Error(error.message);
  return data as Contract;
}

export async function voidContract(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("contract").update({ status: "void" }).eq("id", id);
  if (error) throw new Error(error.message);
}
