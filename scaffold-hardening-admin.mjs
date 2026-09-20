#!/usr/bin/env node
/**
 * Hardening - Admin user management
 * Usage: node scaffold-hardening-admin.mjs
 */

import { mkdir, writeFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import { join, dirname } from "node:path";

const ROOT = process.cwd();
const FILES = {};

async function exists(p) {
  try { await access(p, constants.F_OK); return true; } catch { return false; }
}

// -----------------------------------------------------------------------------
// DB layer
// -----------------------------------------------------------------------------
FILES["src/lib/db/admin.ts"] =
`import "server-only";
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

export async function assignRole(input: {
  user_id: string;
  role_id: string;
  scope_type: "global" | "property" | "self";
  scope_property_id: string | null;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("user_role").upsert({
    user_id: input.user_id,
    role_id: input.role_id,
    scope_type: input.scope_type,
    scope_property_id: input.scope_property_id,
  });
  if (error) throw new Error(error.message);
}

export async function revokeRole(user_id: string, role_id: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("user_role").delete().eq("user_id", user_id).eq("role_id", role_id);
  if (error) throw new Error(error.message);
}

export async function setUserStatus(id: string, status: "active" | "suspended"): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("app_user").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
}
`;

// -----------------------------------------------------------------------------
// Admin page
// -----------------------------------------------------------------------------
FILES["src/app/(dashboard)/admin/page.tsx"] =
`import { requirePagePermission } from "@/lib/auth/guard";
import { listUsers, listRoles } from "@/lib/db/admin";
import { listProperties } from "@/lib/db/properties";
import { PageHeader } from "@/components/layout/page-header";
import { UserTable } from "@/components/admin/user-table";

export default async function AdminHome() {
  await requirePagePermission("user:manage");
  const [users, roles, properties] = await Promise.all([
    listUsers(),
    listRoles(),
    listProperties(),
  ]);

  return (
    <div>
      <PageHeader
        title="System Administration"
        description="Users, roles, and access."
      />
      <UserTable users={users} roles={roles} properties={properties} />
    </div>
  );
}
`;

// -----------------------------------------------------------------------------
// Actions
// -----------------------------------------------------------------------------
FILES["src/app/(dashboard)/admin/actions.ts"] =
`"use server";

import { revalidatePath } from "next/cache";
import { assertPermission } from "@/lib/auth/guard";
import { getSession } from "@/lib/auth/get-session";
import { assignRole, revokeRole, setUserStatus } from "@/lib/db/admin";
import { logAudit } from "@/lib/audit/log";
import { emit } from "@/lib/events/emit";

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
`;

// -----------------------------------------------------------------------------
// Components
// -----------------------------------------------------------------------------
FILES["src/components/admin/user-table.tsx"] =
`"use client";

import { useState, useTransition } from "react";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { assignRoleAction, revokeRoleAction, setUserStatusAction } from "@/app/(dashboard)/admin/actions";
import type { AdminUser } from "@/lib/db/admin";

export function UserTable({
  users,
  roles,
  properties,
}: {
  users: AdminUser[];
  roles: { id: string; key: string; name: string }[];
  properties: { id: string; name: string }[];
}) {
  const [manageUser, setManageUser] = useState<AdminUser | null>(null);

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <Table>
        <THead>
          <TR>
            <TH>Email</TH>
            <TH>Name</TH>
            <TH>Roles</TH>
            <TH>Status</TH>
            <TH className="text-right">Actions</TH>
          </TR>
        </THead>
        <TBody>
          {users.map((u) => (
            <UserRow key={u.id} user={u} onManage={() => setManageUser(u)} />
          ))}
        </TBody>
      </Table>

      <Modal
        open={!!manageUser}
        onClose={() => setManageUser(null)}
        title={manageUser ? "Manage: " + manageUser.email : ""}
        size="lg"
      >
        {manageUser && (
          <ManageRolesForm
            user={manageUser}
            roles={roles}
            properties={properties}
            onDone={() => setManageUser(null)}
          />
        )}
      </Modal>
    </div>
  );
}

function UserRow({ user, onManage }: { user: AdminUser; onManage: () => void }) {
  const [pending, start] = useTransition();
  const toast = useToast();

  function toggleStatus() {
    const next = user.status === "active" ? "suspended" : "active";
    start(async () => {
      try {
        await setUserStatusAction(user.id, next);
        toast.push("User " + next, "success");
      } catch { toast.push("Failed", "error"); }
    });
  }

  return (
    <TR>
      <TD className="font-medium">{user.email}</TD>
      <TD className="text-gray-600">{user.full_name || "—"}</TD>
      <TD>
        <div className="flex flex-wrap gap-1">
          {user.roles.length === 0 ? (
            <span className="text-xs text-gray-400">no roles</span>
          ) : (
            user.roles.map((r) => (
              <Badge key={r.role_key} tone="blue">{r.role_key}</Badge>
            ))
          )}
        </div>
      </TD>
      <TD>
        <Badge tone={user.status === "active" ? "green" : "red"}>{user.status}</Badge>
      </TD>
      <TD className="text-right">
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={onManage}>Manage roles</Button>
          <Button size="sm" variant="ghost" onClick={toggleStatus} loading={pending}>
            {user.status === "active" ? "Suspend" : "Reactivate"}
          </Button>
        </div>
      </TD>
    </TR>
  );
}

function ManageRolesForm({
  user,
  roles,
  properties,
  onDone,
}: {
  user: AdminUser;
  roles: { id: string; key: string; name: string }[];
  properties: { id: string; name: string }[];
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const [roleId, setRoleId] = useState(roles[0]?.id ?? "");
  const [scopeType, setScopeType] = useState<"global" | "property">("global");
  const [propertyId, setPropertyId] = useState(properties[0]?.id ?? "");
  const toast = useToast();

  function grant() {
    if (!roleId) return;
    start(async () => {
      try {
        await assignRoleAction({
          user_id: user.id,
          role_id: roleId,
          scope_type: scopeType,
          scope_property_id: scopeType === "property" ? propertyId : null,
        });
        toast.push("Role assigned", "success");
      } catch { toast.push("Failed", "error"); }
    });
  }

  function revoke(role_key: string) {
    const role = roles.find((r) => r.key === role_key);
    if (!role) return;
    start(async () => {
      try {
        await revokeRoleAction(user.id, role.id);
        toast.push("Role revoked", "success");
      } catch { toast.push("Failed", "error"); }
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium mb-2">Current roles</p>
        {user.roles.length === 0 ? (
          <p className="text-sm text-gray-500">No roles assigned.</p>
        ) : (
          <ul className="space-y-1">
            {user.roles.map((r) => (
              <li key={r.role_key} className="flex items-center justify-between text-sm">
                <span>
                  <Badge tone="blue">{r.role_key}</Badge>{" "}
                  <span className="text-gray-500 text-xs">
                    {r.scope_type}
                    {r.scope_property_id ? " · " + (properties.find((p) => p.id === r.scope_property_id)?.name ?? "") : ""}
                  </span>
                </span>
                <Button size="sm" variant="ghost" onClick={() => revoke(r.role_key)} loading={pending}>
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-gray-200 pt-4 space-y-3">
        <p className="text-sm font-medium">Grant a new role</p>
        <Select
          label="Role"
          options={roles.map((r) => ({ value: r.id, label: r.name }))}
          value={roleId}
          onChange={(e) => setRoleId(e.target.value)}
        />
        <Select
          label="Scope"
          options={[
            { value: "global", label: "Global (all properties)" },
            { value: "property", label: "Single property" },
          ]}
          value={scopeType}
          onChange={(e) => setScopeType(e.target.value as "global" | "property")}
        />
        {scopeType === "property" && (
          <Select
            label="Property"
            options={properties.map((p) => ({ value: p.id, label: p.name }))}
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
          />
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onDone}>Close</Button>
          <Button onClick={grant} loading={pending}>Grant role</Button>
        </div>
      </div>
    </div>
  );
}
`;

async function main() {
  const pkg = join(ROOT, "package.json");
  if (!(await exists(pkg))) { console.error("Run from project root."); process.exit(1); }
  console.log("Hardening - Admin user management\n");
  let n = 0;
  for (const [rel, content] of Object.entries(FILES)) {
    const full = join(ROOT, rel);
    console.log((await exists(full) ? "  ~ " : "  + ") + rel);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, content, "utf8");
    n++;
  }
  console.log("\nDone - " + n + " files written.");
}
main().catch((e) => { console.error(e); process.exit(1); });