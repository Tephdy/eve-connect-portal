import { createClient } from "@/lib/supabase/server";

export async function hasPermission(permissionKey: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("has_perm", {
    p_key: permissionKey,
  });
  if (error) return false;
  return Boolean(data);
}

export async function requirePermission(permissionKey: string) {
  const ok = await hasPermission(permissionKey);
  if (!ok) throw new Error(`Forbidden: missing permission ${permissionKey}`);
}
