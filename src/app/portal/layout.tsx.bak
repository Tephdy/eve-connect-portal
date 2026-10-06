import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/get-session";
import { getUserRoles } from "@/lib/auth/get-user-roles";
import { PortalShell } from "@/components/portal/portal-shell";

export const dynamic = "force-dynamic";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/portal/login");

  const roles = await getUserRoles();
  if (roles.length === 0) redirect("/portal/login");

  return (
    <PortalShell email={session.email ?? ""}>{children}</PortalShell>
  );
}
