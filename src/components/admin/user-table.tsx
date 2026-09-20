"use client";

import { useState, useTransition } from "react";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import {
  assignRoleAction,
  revokeRoleAction,
  setUserStatusAction,
  createUserAction,
} from "@/app/(dashboard)/admin/actions";
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
  const [creating, setCreating] = useState(false);

  return (
    <div>
      <div className="flex justify-end mb-3">
        <Button onClick={() => setCreating(true)}>+ New User</Button>
      </div>

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
      </div>

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

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Create new user"
        size="md"
      >
        <CreateUserForm
          roles={roles}
          properties={properties}
          onDone={() => setCreating(false)}
        />
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
      } catch {
        toast.push("Failed", "error");
      }
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
      } catch {
        toast.push("Failed", "error");
      }
    });
  }

  function revoke(role_key: string) {
    const role = roles.find((r) => r.key === role_key);
    if (!role) return;
    start(async () => {
      try {
        await revokeRoleAction(user.id, role.id);
        toast.push("Role revoked", "success");
      } catch {
        toast.push("Failed", "error");
      }
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
                    {r.scope_property_id
                      ? " · " + (properties.find((p) => p.id === r.scope_property_id)?.name ?? "")
                      : ""}
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

// -----------------------------------------------------------------------------
// Create user form
// -----------------------------------------------------------------------------

function CreateUserForm({
  roles,
  properties,
  onDone,
}: {
  roles: { id: string; key: string; name: string }[];
  properties: { id: string; name: string }[];
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const toast = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [roleId, setRoleId] = useState(roles[0]?.id ?? "");
  const [scopeType, setScopeType] = useState<"global" | "property">("global");
  const [propertyId, setPropertyId] = useState(properties[0]?.id ?? "");

  function submit() {
    if (!email || !password || !roleId) {
      toast.push("Email, password, and role are required", "error");
      return;
    }
    start(async () => {
      const result = await createUserAction({
        email: email.trim(),
        password,
        full_name: fullName.trim(),
        role_id: roleId,
        scope_type: scopeType,
        scope_property_id: scopeType === "property" ? propertyId : null,
      });
      if (result.ok) {
        toast.push("User created", "success");
        onDone();
      } else {
        toast.push(result.error, "error");
      }
    });
  }

  return (
    <div className="space-y-3">
      <Input
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <Input
        label="Full name"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
      />
      <Input
        label="Temporary password"
        type="text"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        hint="Minimum 6 characters. Share this with the user; they can change it later."
        required
      />
      <Select
        label="Initial role"
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
        <Button variant="secondary" onClick={onDone}>Cancel</Button>
        <Button onClick={submit} loading={pending}>Create user</Button>
      </div>
    </div>
  );
}