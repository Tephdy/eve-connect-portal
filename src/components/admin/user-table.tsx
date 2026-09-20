"use client";

import { useState, useTransition } from "react";
import { User as UserIcon, Plus, ShieldCheck, X } from "lucide-react";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { StatusPill } from "@/components/dashboard/status-pill";
import { useToast } from "@/components/ui/toast";
import {
  assignRoleAction,
  revokeRoleAction,
  setUserStatusAction,
  createUserAction,
} from "@/app/(dashboard)/admin/actions";
import type { AdminUser } from "@/lib/db/admin";

const ROLE_LABEL: Record<string, string> = {
  accounting: "Accounting",
  marketing: "Marketing",
  maintenance: "Maintenance",
  property_rep: "Property Rep",
  executive: "Executive",
  system_admin: "System Admin",
};

function initials(email: string) {
  return email.split("@")[0].split(/[._-]/).map((s) => s[0]).join("").slice(0, 2).toUpperCase();
}

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
    <>
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          New User
        </Button>
      </div>

      <Card className="overflow-hidden">
        <CardBody className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>User</TH>
                <TH>Roles</TH>
                <TH>Status</TH>
                <TH className="text-right"></TH>
              </TR>
            </THead>
            <TBody>
              {users.map((u) => (
                <UserRow key={u.id} user={u} onManage={() => setManageUser(u)} />
              ))}
            </TBody>
          </Table>
        </CardBody>
      </Card>

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
    </>
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
      <TD>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-accent-500 text-xs font-semibold text-white">
            {initials(user.email) || <UserIcon className="h-4 w-4" />}
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium text-ink-900">
              {user.full_name || user.email.split("@")[0]}
            </p>
            <p className="truncate text-xs text-ink-500">{user.email}</p>
          </div>
        </div>
      </TD>
      <TD>
        <div className="flex flex-wrap gap-1">
          {user.roles.length === 0 ? (
            <span className="text-xs text-ink-400">no roles</span>
          ) : (
            user.roles.map((r) => (
              <StatusPill key={r.role_key} tone="brand">
                {ROLE_LABEL[r.role_key] ?? r.role_key}
              </StatusPill>
            ))
          )}
        </div>
      </TD>
      <TD>
        <StatusPill tone={user.status === "active" ? "green" : "red"} dot>
          {user.status}
        </StatusPill>
      </TD>
      <TD className="text-right">
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={onManage}>
            <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
            Manage roles
          </Button>
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
        <p className="mb-2 text-sm font-medium text-ink-800">Current roles</p>
        {user.roles.length === 0 ? (
          <p className="text-sm text-ink-500">No roles assigned.</p>
        ) : (
          <ul className="space-y-1.5">
            {user.roles.map((r) => (
              <li
                key={r.role_key}
                className="flex items-center justify-between rounded-lg border border-ink-200 bg-surface-muted px-3 py-2 dark:border-white/[0.06] dark:bg-white/[0.02]"
              >
                <div className="flex items-center gap-2">
                  <StatusPill tone="brand">{ROLE_LABEL[r.role_key] ?? r.role_key}</StatusPill>
                  <span className="text-xs text-ink-500">
                    {r.scope_type}
                    {r.scope_property_id
                      ? " · " + (properties.find((p) => p.id === r.scope_property_id)?.name ?? "")
                      : ""}
                  </span>
                </div>
                <Button size="sm" variant="ghost" onClick={() => revoke(r.role_key)} loading={pending}>
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-3 border-t border-ink-200 pt-4 dark:border-white/[0.06]">
        <p className="text-sm font-medium text-ink-800">Grant a new role</p>
        <Select
          label="Role"
          options={roles.map((r) => ({ value: r.id, label: ROLE_LABEL[r.key] ?? r.name }))}
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
          <Button variant="secondary" onClick={onDone}>
            Close
          </Button>
          <Button onClick={grant} loading={pending}>
            Grant role
          </Button>
        </div>
      </div>
    </div>
  );
}

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
        hint="Minimum 6 characters. Share with the user; they can change it later."
        required
      />
      <Select
        label="Initial role"
        options={roles.map((r) => ({ value: r.id, label: ROLE_LABEL[r.key] ?? r.name }))}
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
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={submit} loading={pending}>
          Create user
        </Button>
      </div>
    </div>
  );
}
