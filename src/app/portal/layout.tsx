import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/get-session";
import { getUserRoles } from "@/lib/auth/get-user-roles";
import { PortalShell } from "@/components/portal/portal-shell";
import { NotificationBanner } from "@/components/portal/notification-banner";
import { getMyNotifications } from "@/lib/db/tenant-notifications";
import { getTenantSelfOrNull } from "@/lib/auth/require-tenant-self";

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

  const self = await getTenantSelfOrNull();

  // Not linked to a tenant - render the fallback here instead of letting
  // the page-level requireTenantSelf() redirect to /portal/not-linked
  // (which would re-run this layout and loop).
  if (!self) {
    return (
      <PortalShell email={session.email ?? ""} notifications={[]}>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="max-w-md space-y-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 text-center">
            <h1 className="text-lg font-semibold text-amber-800 dark:text-amber-400">
              Account not yet linked
            </h1>
            <p className="text-sm text-ink-600">
              Your account exists but isn&apos;t linked to a tenant record yet.
              Please contact the management office and ask them to link your
              account.
            </p>
          </div>
        </div>
      </PortalShell>
    );
  }

  const notifications = await getMyNotifications(self.tenant.id);

  return (
    <PortalShell email={session.email ?? ""} notifications={notifications}>
      <NotificationBanner notifications={notifications} />
      {children}
    </PortalShell>
  );
}
