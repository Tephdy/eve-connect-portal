import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/guard";
import { getTenantProfile } from "@/lib/db/tenant-profile";
import { TenantProfileView } from "@/components/tenant/tenant-profile";
import { SendInviteButton } from "@/components/tenant/send-invite-button";

export default async function TenantProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("tenant:read");
  const { id } = await params;

  const profile = await getTenantProfile(id);
  if (!profile) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <SendInviteButton tenantId={id} />
      </div>
      <TenantProfileView profile={profile} />
    </div>
  );
}
