import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type UserRole = {
  role_key: string;
  scope_type: "global" | "property" | "self";
  scope_property_id: string | null;
};

export const getUserRoles = cache(async (): Promise<UserRole[]> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("user_role")
    .select("role_key, scope_type, scope_property_id")
    .eq("user_id", user.id);

  if (error) return [];

  return (data ?? []).map((row) => ({
    role_key: row.role_key,
    scope_type: row.scope_type,
    scope_property_id: row.scope_property_id,
  }));
});
