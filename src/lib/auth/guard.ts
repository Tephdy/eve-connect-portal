import "server-only";
import { redirect } from "next/navigation";
import { hasPermission } from "./require-permission";
import { getUserRoles } from "./get-user-roles";

/**
 * Server-component guard. Redirects if the user lacks the permission.
 * Use at the top of a page/layout.
 */
export async function requirePagePermission(permission: string) {
  const roles = await getUserRoles();
  if (roles.length === 0) redirect("/login");
  const ok = await hasPermission(permission);
  if (!ok) redirect("/dashboard");
}

/**
 * Non-redirecting check. Use inside server actions.
 */
export async function assertPermission(permission: string) {
  const ok = await hasPermission(permission);
  if (!ok) {
    throw new Error(`Forbidden: missing permission ${permission}`);
  }
}