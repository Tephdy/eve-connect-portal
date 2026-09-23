import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TenantCreateInput, TenantUpdateInput } from "@/lib/schemas/tenant";

export type Tenant = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  messenger_name: string | null;
  government_id: string | null;
  status: "prospect" | "active" | "former" | "blacklisted";
  created_at: string;
  inquiry_id: string | null;
  reservation_id: string | null;
};

const TENANT_SELECT =
  "id, full_name, email, phone, messenger_name, government_id, status, created_at, inquiry_id, reservation_id";

export async function listTenants(): Promise<Tenant[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tenant")
    .select(TENANT_SELECT)
    .order("full_name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Tenant[];
}

export async function getTenant(id: string): Promise<Tenant | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tenant").select(TENANT_SELECT).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Tenant) ?? null;
}

export async function createTenant(
  input: TenantCreateInput & { inquiry_id?: string | null; reservation_id?: string | null }
): Promise<Tenant> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tenant")
    .insert({
      full_name: input.full_name,
      email: input.email || null,
      phone: input.phone || null,
      messenger_name: input.messenger_name || null,
      government_id: input.government_id || null,
      status: input.status,
      inquiry_id: (input as any).inquiry_id ?? null,
      reservation_id: (input as any).reservation_id ?? null,
    })
    .select(TENANT_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return data as Tenant;
}

export async function updateTenant(id: string, input: TenantUpdateInput): Promise<Tenant> {
  const admin = createAdminClient();
  const patch: Record<string, unknown> = {};
  if (input.full_name !== undefined) patch.full_name = input.full_name;
  if (input.email !== undefined) patch.email = input.email || null;
  if (input.phone !== undefined) patch.phone = input.phone || null;
  if (input.messenger_name !== undefined) patch.messenger_name = input.messenger_name || null;
  if (input.government_id !== undefined) patch.government_id = input.government_id || null;
  if (input.status !== undefined) patch.status = input.status;
  const { data, error } = await admin
    .from("tenant").update(patch).eq("id", id).select(TENANT_SELECT).single();
  if (error) throw new Error(error.message);
  return data as Tenant;
}