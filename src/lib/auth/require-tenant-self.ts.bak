import "server-only";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/get-session";
import { createAdminClient } from "@/lib/supabase/admin";

export type SelfTenant = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  messenger_name: string | null;
  status: string;
};

export async function requireTenantSelf(): Promise<{
  session: { id: string; email: string | null };
  tenant: SelfTenant;
}> {
  const session = await getSession();
  if (!session) redirect("/portal/login");

  const admin = createAdminClient();

  const { data: link } = await admin
    .schema("core")
    .from("tenant_user")
    .select("tenant_id")
    .eq("auth_user_id", session.id)
    .eq("relationship", "self")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!link) {
    redirect("/portal/not-linked");
  }

  const { data: tenant } = await admin
    .schema("core")
    .from("tenant")
    .select("id, full_name, email, phone, messenger_name, status")
    .eq("id", (link as { tenant_id: string }).tenant_id)
    .maybeSingle();

  if (!tenant) redirect("/portal/not-linked");

  return {
    session: { id: session.id, email: session.email ?? null },
    tenant: tenant as SelfTenant,
  };
}
