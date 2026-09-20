import { getUserRoles } from "@/lib/auth/get-user-roles";
import { redirect } from "next/navigation";

const ROLE_HOME: Record<string, string> = {
  system_admin: "/admin",
  executive: "/executive",
  accounting: "/accounting",
  marketing: "/marketing",
  maintenance: "/maintenance",
  property_rep: "/property",
};

export default async function DashboardRouter() {
  const roles = await getUserRoles();
  if (roles.length === 0) redirect("/login");

  const target = ROLE_HOME[roles[0].role_key] ?? "/dashboard";
  redirect(target);
}
