import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";


export type AdminUser = {
  id: string;
  email: string;
  full_name: string;
  status: "active" | "suspended";
  created_at: string;
  roles: { role_key: string; scope_type: string; scope_property_id: string | null }[];
};

// -----------------------------------------------------------------------------
// Reads — anon client + public views
// -----------------------------------------------------------------------------

export async function listUsers(): Promise<AdminUser[]> {
  const supabase = await createClient();
  const { data: users, error } = await supabase
    .from("app_user")
    .select("id, email, full_name, status, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const ids = (users ?? []).map((u: any) => u.id);
  const { data: userRoles } = await supabase
    .from("user_role")
    .select("user_id, role_key, scope_type, scope_property_id")
    .in("user_id", ids);

  const roleMap = new Map<string, AdminUser["roles"]>();
  for (const r of userRoles ?? []) {
    const list = roleMap.get(r.user_id) ?? [];
    list.push({
      role_key: r.role_key,
      scope_type: r.scope_type,
      scope_property_id: r.scope_property_id,
    });
    roleMap.set(r.user_id, list);
  }

  return (users ?? []).map((u: any) => ({
    ...u,
    roles: roleMap.get(u.id) ?? [],
  }));
}

export async function listRoles(): Promise<{ id: string; key: string; name: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("role").select("id, key, name").order("key");
  if (error) throw new Error(error.message);
  return data ?? [];
}

// -----------------------------------------------------------------------------
// Writes — admin client, direct to core.* tables
// -----------------------------------------------------------------------------

function logWriteError(fn: string, error: any) {
  console.error(`[${fn}]`, JSON.stringify(error, null, 2));
}

export async function assignRole(input: {
  user_id: string;
  role_id: string;
  scope_type: "global" | "property" | "self";
  scope_property_id: string | null;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .schema("core")
    .from("user_role")
    .upsert(
      {
        user_id: input.user_id,
        role_id: input.role_id,
        scope_type: input.scope_type,
        scope_property_id: input.scope_property_id,
      },
      { onConflict: "user_id,role_id" }
    );
  if (error) {
    logWriteError("assignRole", error);
    throw new Error(error.message);
  }
}

export async function revokeRole(user_id: string, role_id: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .schema("core")
    .from("user_role")
    .delete()
    .eq("user_id", user_id)
    .eq("role_id", role_id);
  if (error) {
    logWriteError("revokeRole", error);
    throw new Error(error.message);
  }
}

export async function setUserStatus(
  id: string,
  status: "active" | "suspended"
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .schema("core")
    .from("app_user")
    .update({ status })
    .eq("id", id);
  if (error) {
    logWriteError("setUserStatus", error);
    throw new Error(error.message);
  }
}

// -----------------------------------------------------------------------------
// User creation
// -----------------------------------------------------------------------------

export async function createAppUser(input: {
  email: string;
  password: string;
  full_name: string;
  role_id: string;
  scope_type: "global" | "property" | "self";
  scope_property_id: string | null;
}): Promise<{ id: string; email: string }> {
  const admin = createAdminClient();

  // 1. Create the auth user via Supabase Admin API
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.full_name },
  });

  if (createErr || !created.user) {
    console.error("[createAppUser] auth create failed:", createErr);
    throw new Error(createErr?.message ?? "Failed to create user");
  }

  const userId = created.user.id;

  // 2. Ensure core.app_user row exists (the trigger should handle it, but be safe)
  const { error: appUserErr } = await admin
    .schema("core")
    .from("app_user")
    .upsert(
      {
        id: userId,
        email: input.email,
        full_name: input.full_name,
        status: "active",
      },
      { onConflict: "id" }
    );

  if (appUserErr) {
    console.error("[createAppUser] app_user upsert failed:", appUserErr);
    throw new Error(appUserErr.message);
  }

  // 3. Assign the initial role
  const { error: roleErr } = await admin
    .schema("core")
    .from("user_role")
    .upsert(
      {
        user_id: userId,
        role_id: input.role_id,
        scope_type: input.scope_type,
        scope_property_id: input.scope_property_id,
      },
      { onConflict: "user_id,role_id" }
    );

  if (roleErr) {
    console.error("[createAppUser] role assign failed:", roleErr);
    throw new Error(roleErr.message);
  }

  return { id: userId, email: input.email };
}