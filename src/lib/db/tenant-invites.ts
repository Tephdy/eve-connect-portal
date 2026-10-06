import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateInviteToken, hashInviteToken, INVITE_EXPIRY_DAYS } from "@/lib/invites/tokens";

export type TenantInvite = {
  id: string;
  tenant_id: string;
  created_by: string | null;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  used_by: string | null;
};

export async function createTenantInvite(input: {
  tenant_id: string;
  created_by: string | null;
}): Promise<{ invite: TenantInvite; rawToken: string }> {
  const admin = createAdminClient();

  const { error: invalidateErr } = await admin
    .schema("core")
    .from("tenant_invite")
    .update({ used_at: new Date().toISOString() })
    .eq("tenant_id", input.tenant_id)
    .is("used_at", null);

  if (invalidateErr) {
    throw new Error("Failed to invalidate prior invites: " + invalidateErr.message);
  }

  const { raw, hash } = generateInviteToken();
  const expiresAt = new Date(
    Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data, error } = await admin
    .schema("core")
    .from("tenant_invite")
    .insert({
      tenant_id: input.tenant_id,
      token_hash: hash,
      created_by: input.created_by,
      expires_at: expiresAt,
    })
    .select("id, tenant_id, created_by, created_at, expires_at, used_at, used_by")
    .single();

  if (error) throw new Error(error.message);
  return { invite: data as TenantInvite, rawToken: raw };
}

export async function findUsableInvite(rawToken: string): Promise<TenantInvite | null> {
  const hash = hashInviteToken(rawToken);
  const admin = createAdminClient();

  const { data, error } = await admin
    .schema("core")
    .from("tenant_invite")
    .select("id, tenant_id, created_by, created_at, expires_at, used_at, used_by")
    .eq("token_hash", hash)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error || !data) return null;
  return data as TenantInvite;
}

export async function getInviteTenantName(tenant_id: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .schema("core")
    .from("tenant")
    .select("full_name")
    .eq("id", tenant_id)
    .maybeSingle();
  return (data as { full_name: string } | null)?.full_name ?? null;
}

export async function markInviteUsed(input: {
  invite_id: string;
  used_by: string;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .schema("core")
    .from("tenant_invite")
    .update({ used_at: new Date().toISOString(), used_by: input.used_by })
    .eq("id", input.invite_id);
  if (error) throw new Error(error.message);
}
