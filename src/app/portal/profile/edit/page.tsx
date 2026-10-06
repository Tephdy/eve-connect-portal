import { redirect } from "next/navigation";
import { requireTenantSelf } from "@/lib/auth/require-tenant-self";
import { getMyProfile } from "@/lib/db/tenant-profile";
import { listMyLeases, getMyInspection } from "@/lib/db/tenant-portal";
import { ProfileEditForm } from "./profile-edit-form";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function ProfileEditPage() {
  const { tenant } = await requireTenantSelf();

  const [profile, leases] = await Promise.all([
    getMyProfile(tenant.id),
    listMyLeases(tenant.id),
  ]);

  if (!profile) redirect("/portal/profile");

   const activeLease = leases.find((l: { is_active: boolean }) => l.is_active);

  let inspection = null;
  if (activeLease) {
    inspection = await getMyInspection(activeLease.id, tenant.id);
  }

  const admin = createAdminClient();
  const { data: rawTenant } = await admin
    .schema("core")
    .from("tenant")
    .select(
      "first_name, middle_name, last_name, birth_date, gender, nationality, religion, civil_status, permanent_address, recent_address, phone, messenger_name, email, company, work_status, work_position, company_address, company_tel, company_email, company_messenger, marketing_source, ec1_name, ec1_phone, ec1_email, ec1_messenger, ec2_name, ec2_phone, ec2_email, ec2_messenger"
    )
    .eq("id", tenant.id)
    .maybeSingle();

  return (
    <ProfileEditForm
      tenant={(rawTenant as Record<string, string | null>) ?? {}}
      activeLeaseId={activeLease?.id ?? null}
      inspection={(inspection as unknown as Record<string, unknown>) ?? null}
    />
  );
}
