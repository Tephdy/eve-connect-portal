import { requirePagePermission } from "@/lib/auth/guard";
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
