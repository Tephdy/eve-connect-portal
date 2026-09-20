import { requirePagePermission } from "@/lib/auth/guard";
import { listUsers, listRoles } from "@/lib/db/admin";
import { listProperties } from "@/lib/db/properties";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { UserTable } from "@/components/admin/user-table";

export default async function AdminHome() {
  await requirePagePermission("user:manage");
  const [users, roles, properties] = await Promise.all([
    listUsers(),
    listRoles(),
    listProperties(),
  ]);

  const active = users.filter((u) => u.status === "active").length;
  const suspended = users.filter((u) => u.status === "suspended").length;
  const withRoles = users.filter((u) => u.roles.length > 0).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Administration"
        description="Users, roles, and access."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total users" value={users.length} accent="brand" />
        <StatCard label="Active" value={active} accent="green" />
        <StatCard label="Suspended" value={suspended} accent="red" />
        <StatCard label="With roles assigned" value={withRoles} accent="purple" />
      </div>

      <UserTable users={users} roles={roles} properties={properties} />
    </div>
  );
}
