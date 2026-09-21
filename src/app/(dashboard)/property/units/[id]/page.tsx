import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/guard";
import { getUnitProfile } from "@/lib/db/unit-profile";
import { UnitProfileView } from "@/components/unit/unit-profile";

export default async function UnitProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("unit:read");
  const { id } = await params;

  const profile = await getUnitProfile(id);
  if (!profile) notFound();

  return <UnitProfileView profile={profile} />;
}
