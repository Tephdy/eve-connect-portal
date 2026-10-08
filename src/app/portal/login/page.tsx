import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/get-session";
import { getUserRoleKeys } from "@/lib/auth/get-user-roles-server";
import { PortalLoginForm } from "./portal-login-form";

export const dynamic = "force-dynamic";

export default async function PortalLoginPage() {
  const session = await getSession();

  // If already logged in: route by role so staff don't see the tenant login.
  if (session) {
    const roles = await getUserRoleKeys();
    const isTenant = roles.includes("tenant");
    redirect(isTenant ? "/portal" : "/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-6">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-ink-200 bg-surface p-6 shadow-sm dark:border-white/[0.06]">
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-semibold text-ink-900">
            Tenant portal
          </h1>
          <p className="text-sm text-ink-500">
            Sign in to view your lease, invoices, and payments.
          </p>
        </div>
        <PortalLoginForm />
      </div>
    </div>
  );
}
