import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/guard";
import { getPropertyProfile } from "@/lib/db/property-profile";
import { PropertyProfileView } from "@/components/property/property-profile";

export default async function PropertyProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("property:read");
  const { id } = await params;

  const profile = await getPropertyProfile(id);
  if (!profile) notFound();

  return <PropertyProfileView profile={profile} />;
}
