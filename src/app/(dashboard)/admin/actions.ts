"use server";

import { revalidatePath } from "next/cache";
import { assertPermission } from "@/lib/auth/guard";
import { getSession } from "@/lib/auth/get-session";
import { assignRole, revokeRole, setUserStatus } from "@/lib/db/admin";
import { logAudit } from "@/lib/audit/log";
import { emit } from "@/lib/events/emit";

import { createAppUser } from "@/lib/db/admin";

export async function createUserAction(input: {
  email: string;
  password: string;
  full_name: string;
  role_id: string;
  scope_type: "global" | "property" | "self";
  scope_property_id: string | null;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  await assertPermission("user:manage");
  const session = await getSession();

  try {
    const created = await createAppUser(input);

    await logAudit({
      actor_id: session?.id ?? null,
      entity_type: "app_user",
      entity_id: created.id,
      action: "create",
      after: { email: created.email, role_id: input.role_id, scope_type: input.scope_type },
    });

    await emit("user.created", {
      user_id: created.id,
      email: created.email,
      role_id: input.role_id,
    }, session?.id ?? null);

    revalidatePath("/admin");
    return { ok: true, id: created.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to create user" };
  }
}

export async function assignRoleAction(input: {
  user_id: string;
  role_id: string;
  scope_type: "global" | "property" | "self";
  scope_property_id: string | null;
}) {
  await assertPermission("role:manage");
  const session = await getSession();

  await assignRole(input);

  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "user_role",
    entity_id: input.user_id,
    action: "update",
    after: input,
  });

  await emit("user.role_changed", {
    user_id: input.user_id,
    role_id: input.role_id,
    action: "granted",
  }, session?.id ?? null);

  revalidatePath("/admin");
}

export async function revokeRoleAction(user_id: string, role_id: string) {
  await assertPermission("role:manage");
  const session = await getSession();

  await revokeRole(user_id, role_id);

  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "user_role",
    entity_id: user_id,
    action: "update",
    before: { role_id },
    reason: "revoked",
  });

  await emit("user.role_changed", {
    user_id,
    role_id,
    action: "revoked",
  }, session?.id ?? null);

  revalidatePath("/admin");
}

export async function setUserStatusAction(id: string, status: "active" | "suspended") {
  await assertPermission("user:manage");
  const session = await getSession();

  await setUserStatus(id, status);

  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "app_user",
    entity_id: id,
    action: "update",
    after: { status },
  });

  revalidatePath("/admin");
}
