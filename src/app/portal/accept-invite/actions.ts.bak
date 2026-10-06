"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { findUsableInvite, markInviteUsed } from "@/lib/db/tenant-invites";
import { isPlausibleToken } from "@/lib/invites/tokens";
import { logAudit } from "@/lib/audit/log";
import type { ActionResult } from "@/lib/actions/result";

export async function acceptInviteAction(input: {
  token: string;
  email: string;
  password: string;
}): Promise<ActionResult<{ email: string }>> {
  if (!isPlausibleToken(input.token)) {
    return { ok: false, error: "Invalid invite link" };
  }
  if (!input.email || !input.email.includes("@")) {
    return { ok: false, error: "Invalid email" };
  }
  if (!input.password || input.password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters" };
  }

  const invite = await findUsableInvite(input.token);
  if (!invite) {
    return {
      ok: false,
      error: "This invite is expired or already used. Ask the office to send a new one.",
    };
  }

  const admin = createAdminClient();

  // Create the auth user with email already confirmed.
  // email_confirm: true -> no confirmation email, immediately usable.
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
  });

  if (createErr) {
    const msg = createErr.message ?? "";
    if (msg.toLowerCase().includes("already")) {
      return {
        ok: false,
        error: "This email is already registered. Try logging in instead.",
      };
    }
    return { ok: false, error: msg || "Failed to create account" };
  }

  if (!created?.user?.id) {
    return { ok: false, error: "Account creation failed" };
  }

  const newUserId = created.user.id;

  // Ensure core.app_user row exists. The auth trigger should create it,
  // but upsert is safe and idempotent.
  const { error: appUserErr } = await admin
    .schema("core")
    .from("app_user")
    .upsert(
      {
        id: newUserId,
        email: input.email,
        full_name: "",
        status: "active",
      },
      { onConflict: "id" }
    );

  if (appUserErr) {
    console.error("[acceptInviteAction] app_user upsert failed:", appUserErr);
    return {
      ok: false,
      error: "Account creation failed: " + appUserErr.message,
    };
  }

  // Grant the tenant role.
  const { data: tenantRole } = await admin
    .schema("core")
    .from("role")
    .select("id")
    .eq("key", "tenant")
    .maybeSingle();

  if (tenantRole) {
    const { error: roleErr } = await admin
      .schema("core")
      .from("user_role")
      .insert({
        user_id: newUserId,
        role_id: (tenantRole as { id: string }).id,
        scope_type: "global",
      });

    if (roleErr) {
      console.error("[acceptInviteAction] user_role insert failed:", roleErr);
      return {
        ok: false,
        error: "Failed to grant tenant role: " + roleErr.message,
      };
    }
  }

  // Link the auth user to the tenant. verified_at = now() because the invite
  // itself proves ownership - staff sent the link to the tenant's known contact.
  // Use insert (not upsert) - the user is brand new, there's nothing to conflict with.
  // Upsert with composite-key onConflict is unreliable through PostgREST.
  const { error: linkErr } = await admin
    .schema("core")
    .from("tenant_user")
    .insert({
      auth_user_id: newUserId,
      tenant_id: invite.tenant_id,
      relationship: "self",
      verified_at: new Date().toISOString(),
    });

  if (linkErr) {
    console.error("[acceptInviteAction] tenant_user insert failed:", linkErr);
    return {
      ok: false,
      error: "Account created but linking failed: " + linkErr.message,
    };
  }

  await markInviteUsed({ invite_id: invite.id, used_by: newUserId });

  await logAudit({
    actor_id: newUserId,
    entity_type: "tenant_user",
    entity_id: invite.tenant_id,
    action: "create",
    after: { auth_user_id: newUserId, tenant_id: invite.tenant_id },
    reason: "Accepted invite",
  });

  // Auto sign-in: create a session for the new user using the anon client.
  // We use signInWithPassword on the server-side client, which writes cookies.
  const supabase = await createClient();
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });

  if (signInErr) {
    // Account was created and linked; sign-in failed. User can still log in manually.
    return {
      ok: false,
      error: "Account created but auto-login failed. Please log in manually.",
    };
  }

  return { ok: true, data: { email: input.email } };
}