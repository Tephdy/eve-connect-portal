import { requireTenantSelf } from "@/lib/auth/require-tenant-self";

export const dynamic = "force-dynamic";

export default async function PortalHomePage() {
  const { tenant, session } = await requireTenantSelf();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-ink-900">
          Welcome, {tenant.full_name}
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Signed in as {session.email ?? ""}
        </p>
      </div>

      <div className="grid gap-4">
        <div className="rounded-xl border border-ink-200 bg-surface p-4 dark:border-white/[0.06]">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
            Tenant
          </p>
          <p className="mt-1 text-sm text-ink-800">{tenant.full_name}</p>
          {tenant.email && (
            <p className="text-xs text-ink-500">{tenant.email}</p>
          )}
        </div>

        <div className="rounded-xl border border-ink-200 bg-surface p-4 dark:border-white/[0.06]">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
            Status
          </p>
          <p className="mt-1 text-sm capitalize text-ink-800">{tenant.status}</p>
        </div>
      </div>

      <p className="text-xs text-ink-400">
        More sections coming soon - Lease, Invoices, Payments, Utilities.
      </p>
    </div>
  );
}
