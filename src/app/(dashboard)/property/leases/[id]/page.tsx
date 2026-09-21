import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/guard";
import { getLeaseProfile } from "@/lib/db/lease-profile";
import { LeaseProfileView } from "@/components/lease/lease-profile";

export default async function LeaseProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("lease:read");
  const { id } = await params;

  const profile = await getLeaseProfile(id);
  if (!profile) notFound();

  return <LeaseProfileView profile={profile} />;
}
