import { findUsableInvite, getInviteTenantName } from "@/lib/db/tenant-invites";
import { isPlausibleToken } from "@/lib/invites/tokens";
import { AcceptInviteForm } from "./accept-invite-form";

export const dynamic = "force-dynamic";

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const sp = await searchParams;
  const token = sp.token?.trim() ?? "";

  if (!token || !isPlausibleToken(token)) {
    return <InvalidState reason="This link is malformed or incomplete." />;
  }

  const invite = await findUsableInvite(token);
  if (!invite) {
    return (
      <InvalidState reason="This link is expired, already used, or invalid. Ask the office to send a new one." />
    );
  }

  const tenantName = await getInviteTenantName(invite.tenant_id);

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-6">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-ink-200 bg-surface p-6 shadow-sm dark:border-white/[0.06]">
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-semibold text-ink-900">
            Create your login
          </h1>
          <p className="text-sm text-ink-500">
            {tenantName ? "Welcome, " + tenantName : "Welcome"}
          </p>
        </div>

        <AcceptInviteForm token={token} />

        <p className="text-center text-xs text-ink-400">
          You will be logged in automatically after submitting.
        </p>
      </div>
    </div>
  );
}

function InvalidState({ reason }: { reason: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-6">
      <div className="w-full max-w-md space-y-3 rounded-2xl border border-danger-500/30 bg-danger-500/5 p-6 text-center dark:border-danger-500/20">
        <h1 className="text-lg font-semibold text-danger-700 dark:text-danger-500">
          Invite link problem
        </h1>
        <p className="text-sm text-ink-600">{reason}</p>
      </div>
    </div>
  );
}
