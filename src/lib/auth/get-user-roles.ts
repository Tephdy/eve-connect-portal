import { createClient } from "@/lib/supabase/server";

export type UserRole = {
  role_key: string;
  scope_type: "global" | "property" | "self";
  scope_property_id: string | null;
};

export async function getUserRoles(): Promise<UserRole[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error, status, statusText } = await supabase
    .from("user_role")
    .select("role_key, scope_type, scope_property_id")
    .eq("user_id", user.id);

  if (error) {
    console.error("[getUserRoles] status:", status, statusText);
    console.error("[getUserRoles] message:", error.message);
    console.error("[getUserRoles] details:", error.details);
    console.error("[getUserRoles] hint:", error.hint);
    console.error("[getUserRoles] code:", error.code);
    return [];
  }

  return (data ?? []).map((row) => ({
    role_key: row.role_key,
    scope_type: row.scope_type,
    scope_property_id: row.scope_property_id,
  }));
}