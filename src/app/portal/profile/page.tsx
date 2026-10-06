import { requireTenantSelf } from "@/lib/auth/require-tenant-self";
import { getMyProfile } from "@/lib/db/tenant-profile";
import { PortalProfileView } from "@/components/portal/profile/profile-view";

export const dynamic = "force-dynamic";

export default async function PortalProfilePage() {
  const { tenant } = await requireTenantSelf();
  const profile = await getMyProfile(tenant.id);

  if (!profile) {
    return (
      <div className="rounded-xl border border-ink-200 bg-surface p-6 text-center dark:border-white/[0.06]">
        <p className="text-sm text-ink-500">
          Could not load your profile. Contact the management office.
        </p>
      </div>
    );
  }

  return <PortalProfileView profile={profile} />;
}
