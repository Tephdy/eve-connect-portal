import "server-only";
import { createClient } from "@/lib/supabase/server";

// Non-cached role lookup for use inside route handlers and other
// server-only contexts where the React cache from getUserRoles is not
// appropriate. Returns the raw role keys for the current user.

export async function getUserRoleKeys(): Promise<string[]> {
  const supabase = await createClient();

  let userId: string | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;
  } catch {
    return [];
  }
  if (!userId) return [];

  const { data } = await supabase
    .from("user_role")
    .select("role_key")
    .eq("user_id", userId);

  return (data ?? []).map((r: any) => String(r.role_key));
}
