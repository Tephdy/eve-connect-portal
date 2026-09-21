import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/guard";
import { getTenantProfile } from "@/lib/db/tenant-profile";
import { TenantProfileView } from "@/components/tenant/tenant-profile";

export default async function TenantProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("tenant:read");
  const { id } = await params;

  const profile = await getTenantProfile(id);
  if (!profile) notFound();

  return <TenantProfileView profile={profile} />;
}
