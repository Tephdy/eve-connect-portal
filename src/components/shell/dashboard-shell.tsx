"use client";

export function DashboardShell({
  sidebar,
  topbar,
  children,
}: {
  sidebar: React.ReactNode;
  topbar: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="app-shell-v2" style={{ gridTemplateColumns: "16rem 1fr" }}>
      <aside className="app-sidebar-v2">{sidebar}</aside>
      <header className="app-header-v2">{topbar}</header>
      <main className="app-main-v2">
        <div className="mx-auto max-w-[1500px] p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
