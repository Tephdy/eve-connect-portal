import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/get-session";
import { getUserRoles } from "@/lib/auth/get-user-roles";
import { getReminders } from "@/lib/calendar/reminders";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { DashboardShell } from "@/components/shell/dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();
  if (!user) redirect("/login");

  const roles = await getUserRoles();

  let reminders = [] as Awaited<ReturnType<typeof getReminders>>;
  try {
    reminders = await getReminders();
  } catch (err) {
    console.error("[layout] failed to load reminders", err);
  }

  return (
    <DashboardShell
      sidebar={<Sidebar roles={roles} email={user.email ?? ""} />}
      topbar={<Topbar roles={roles} reminders={reminders} />}
      roles={roles}
      reminders={reminders}
    >
      {children}
    </DashboardShell>
  );
}
