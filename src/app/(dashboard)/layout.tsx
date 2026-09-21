import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/get-session";
import { getUserRoles } from "@/lib/auth/get-user-roles";
import { getReminders } from "@/lib/calendar/reminders";
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

  // Load reminders for the bell — fail silently if anything goes wrong
  let reminders = [] as Awaited<ReturnType<typeof getReminders>>;
  try {
    reminders = await getReminders();
  } catch (err) {
    console.error("[layout] failed to load reminders", err);
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar border-r border-ink-200/60 bg-surface dark:border-white/[0.06]">
        <Sidebar roles={roles} email={user.email ?? ""} />
      </aside>

      <header className="app-header border-b border-ink-200/60 bg-surface/80 backdrop-blur-md dark:border-white/[0.06] dark:bg-surface/70">
        <Topbar roles={roles} reminders={reminders} />
      </header>

      <main className="app-main">
        <div className="mx-auto max-w-[1500px] p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
