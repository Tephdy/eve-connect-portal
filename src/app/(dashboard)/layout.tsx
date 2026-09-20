import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/get-session";
import { getUserRoles } from "@/lib/auth/get-user-roles";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();
  if (!user) redirect("/login");

  const roles = await getUserRoles();

  return (
    <div className="app-shell">
      <aside className="app-sidebar border-r border-ink-200 bg-surface">
        <Sidebar roles={roles} />
      </aside>

      <header className="app-header border-b border-ink-200 bg-surface">
        <Topbar email={user.email ?? ""} roles={roles} />
      </header>

      <main className="app-main">
        <div className="mx-auto max-w-[1400px] p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
