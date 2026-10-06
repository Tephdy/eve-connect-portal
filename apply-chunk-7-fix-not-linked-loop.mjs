// apply-chunk-7-fix-not-linked-loop.mjs
// Fixes the /portal/not-linked redirect loop.
// 1. Appends getTenantSelfOrNull() to require-tenant-self.ts
// 2. Replaces portal/layout.tsx
// 3. Deletes portal/not-linked/page.tsx (moves to .bak first)
// All edits are signature-guarded. Aborts on mismatch.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  unlinkSync,
  rmdirSync,
} from "node:fs";
import { dirname } from "node:path";

// ===========================================================================
// 1. Append to require-tenant-self.ts
// ===========================================================================

const SELF_PATH = "src/lib/auth/require-tenant-self.ts";
const SELF_MARKER = "// ---- GET TENANT SELF OR NULL (added by apply-chunk-7) ----";
const SELF_SIGNATURE = "export async function requireTenantSelf()";

const SELF_APPEND = `

${SELF_MARKER}

/**
 * Non-redirecting variant. Returns null if the caller isn't a linked tenant.
 * Use this in layouts where a redirect would loop back into the same layout.
 */
export async function getTenantSelfOrNull(): Promise<{
  session: { id: string; email: string | null };
  tenant: SelfTenant;
} | null> {
  const session = await getSession();
  if (!session) return null;

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

  if (!link) return null;

  const { data: tenant } = await admin
    .schema("core")
    .from("tenant")
    .select("id, full_name, email, phone, messenger_name, status")
    .eq("id", (link as { tenant_id: string }).tenant_id)
    .maybeSingle();

  if (!tenant) return null;

  return {
    session: { id: session.id, email: session.email ?? null },
    tenant: tenant as SelfTenant,
  };
}
`;

// ===========================================================================
// 2. Replace portal/layout.tsx
// ===========================================================================

const LAYOUT_PATH = "src/app/portal/layout.tsx";
const LAYOUT_SIGNATURE = "export default async function PortalLayout";

const LAYOUT_NEW = `import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/get-session";
import { getUserRoles } from "@/lib/auth/get-user-roles";
import { PortalShell } from "@/components/portal/portal-shell";
import { NotificationBanner } from "@/components/portal/notification-banner";
import { getMyNotifications } from "@/lib/db/tenant-notifications";
import { getTenantSelfOrNull } from "@/lib/auth/require-tenant-self";

export const dynamic = "force-dynamic";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/portal/login");

  const roles = await getUserRoles();
  if (roles.length === 0) redirect("/portal/login");

  const self = await getTenantSelfOrNull();

  // Not linked to a tenant - render the fallback here instead of letting
  // the page-level requireTenantSelf() redirect to /portal/not-linked
  // (which would re-run this layout and loop).
  if (!self) {
    return (
      <PortalShell email={session.email ?? ""} notifications={[]}>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="max-w-md space-y-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 text-center">
            <h1 className="text-lg font-semibold text-amber-800 dark:text-amber-400">
              Account not yet linked
            </h1>
            <p className="text-sm text-ink-600">
              Your account exists but isn&apos;t linked to a tenant record yet.
              Please contact the management office and ask them to link your
              account.
            </p>
          </div>
        </div>
      </PortalShell>
    );
  }

  const notifications = await getMyNotifications(self.tenant.id);

  return (
    <PortalShell email={session.email ?? ""} notifications={notifications}>
      <NotificationBanner notifications={notifications} />
      {children}
    </PortalShell>
  );
}
`;

// ===========================================================================
// 3. Delete portal/not-linked/page.tsx (backup to .bak)
// ===========================================================================

const NOT_LINKED_PAGE = "src/app/portal/not-linked/page.tsx";
const NOT_LINKED_DIR = "src/app/portal/not-linked";

// ===========================================================================
// Runner
// ===========================================================================

console.log("=== apply-chunk-7-fix-not-linked-loop.mjs ===");
console.log("");

// ---- Part 1: append getTenantSelfOrNull ----
console.log("--- Part 1: require-tenant-self.ts ---");
if (!existsSync(SELF_PATH)) {
  console.error("MISSING  " + SELF_PATH);
} else {
  const src = readFileSync(SELF_PATH, "utf8");
  if (src.includes(SELF_MARKER)) {
    console.log("SKIP   " + SELF_PATH + "  (already appended)");
  } else if (!src.includes(SELF_SIGNATURE)) {
    console.error("ABORT  " + SELF_PATH + "  (signature not found)");
  } else {
    copyFileSync(SELF_PATH, SELF_PATH + ".bak");
    writeFileSync(SELF_PATH, src + SELF_APPEND, "utf8");
    console.log("PATCH  " + SELF_PATH + "  (appended getTenantSelfOrNull)");
  }
}
console.log("");

// ---- Part 2: replace layout ----
console.log("--- Part 2: portal/layout.tsx ---");
if (!existsSync(LAYOUT_PATH)) {
  console.error("MISSING  " + LAYOUT_PATH);
} else {
  const src = readFileSync(LAYOUT_PATH, "utf8");
  if (src.includes("getTenantSelfOrNull")) {
    console.log("SKIP   " + LAYOUT_PATH + "  (already patched)");
  } else if (!src.includes(LAYOUT_SIGNATURE)) {
    console.error("ABORT  " + LAYOUT_PATH + "  (signature not found)");
  } else {
    copyFileSync(LAYOUT_PATH, LAYOUT_PATH + ".bak");
    writeFileSync(LAYOUT_PATH, LAYOUT_NEW, "utf8");
    console.log("REPLACE " + LAYOUT_PATH);
  }
}
console.log("");

// ---- Part 3: remove not-linked page ----
console.log("--- Part 3: portal/not-linked ---");
if (!existsSync(NOT_LINKED_PAGE)) {
  console.log("SKIP   " + NOT_LINKED_PAGE + "  (already removed)");
} else {
  copyFileSync(NOT_LINKED_PAGE, NOT_LINKED_PAGE + ".bak");
  unlinkSync(NOT_LINKED_PAGE);
  console.log("DELETE " + NOT_LINKED_PAGE + "  (backup at .bak)");
  // Remove the empty directory if possible
  try {
    rmdirSync(NOT_LINKED_DIR);
    console.log("DELETE " + NOT_LINKED_DIR + "  (empty dir removed)");
  } catch {
    console.log("KEEP   " + NOT_LINKED_DIR + "  (dir not empty, leaving)");
  }
}
console.log("");

console.log("=== Done ===");
console.log("");
console.log("Next:");
console.log("  npm run typecheck");
console.log("  git add .");
console.log('  git commit -m "Fix /portal/not-linked redirect loop"');
console.log("  git push");