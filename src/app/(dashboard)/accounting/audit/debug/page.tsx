import { getUserRoles } from "@/lib/auth/get-user-roles";
import { hasPermission } from "@/lib/auth/require-permission";

export const dynamic = "force-dynamic";

export default async function DebugPage() {
  const roles = await getUserRoles();
  const keys = ["audit:read", "audit:manage", "invoice:read"];
  const checks = await Promise.all(keys.map((k) => hasPermission(k)));
  const perms: Record<string, boolean> = {};
  keys.forEach((k, i) => { perms[k] = checks[i]; });

  return (
    <pre style={{ padding: 24, fontFamily: "ui-monospace, monospace", fontSize: 13, lineHeight: 1.5 }}>
      {JSON.stringify({ roles, permissions: perms }, null, 2)}
    </pre>
  );
}
