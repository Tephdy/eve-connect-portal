#!/usr/bin/env node
/**
 * fix-audit-perms.mjs
 * Diagnoses why /accounting/audit redirects to /dashboard.
 * - Writes a temp debug page.
 * - Writes a SQL script that ensures audit:* permissions exist
 *   and are granted to accounting + executive.
 * Usage: node fix-audit-perms.mjs
 */
import { mkdir, writeFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import { join, dirname } from "node:path";

const ROOT = process.cwd();
const j = (lines) => lines.join("\n") + "\n";

async function exists(p) {
  try { await access(p, constants.F_OK); return true; } catch { return false; }
}

async function write(rel, content) {
  const full = join(ROOT, rel);
  if (await exists(full)) {
    console.log("  = skip (exists): " + rel);
    return;
  }
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, content, "utf8");
  console.log("  + created: " + rel);
}

// ---------------------------------------------------------------------------
// 1. Debug page
// ---------------------------------------------------------------------------

await write(
  "src/app/(dashboard)/accounting/audit/debug/page.tsx",
  j([
    'import { getUserRoles } from "@/lib/auth/get-user-roles";',
    'import { hasPermission } from "@/lib/auth/require-permission";',
    '',
    'export const dynamic = "force-dynamic";',
    '',
    'export default async function DebugPage() {',
    '  const roles = await getUserRoles();',
    '  const keys = ["audit:read", "audit:manage", "invoice:read"];',
    '  const checks = await Promise.all(keys.map((k) => hasPermission(k)));',
    '  const perms: Record<string, boolean> = {};',
    '  keys.forEach((k, i) => { perms[k] = checks[i]; });',
    '',
    '  return (',
    '    <pre style={{ padding: 24, fontFamily: "ui-monospace, monospace", fontSize: 13, lineHeight: 1.5 }}>',
    '      {JSON.stringify({ roles, permissions: perms }, null, 2)}',
    '    </pre>',
    '  );',
    '}',
  ])
);

// ---------------------------------------------------------------------------
// 2. SQL fix script
// ---------------------------------------------------------------------------

const now = new Date();
const pad = (n) => String(n).padStart(2, "0");
const stamp =
  now.getUTCFullYear() +
  pad(now.getUTCMonth() + 1) +
  pad(now.getUTCDate()) +
  pad(now.getUTCHours()) +
  pad(now.getUTCMinutes()) +
  pad(now.getUTCSeconds());

const sqlName = "supabase/migrations/" + stamp + "_ensure_audit_permissions.sql";

await write(
  sqlName,
  j([
    "-- Ensures audit:read and audit:manage exist and are granted to",
    "-- the accounting and executive roles. Idempotent.",
    "",
    "-- 1. Ensure permission rows exist",
    "insert into core.permission (key) values ('audit:read')",
    "on conflict (key) do nothing;",
    "",
    "insert into core.permission (key) values ('audit:manage')",
    "on conflict (key) do nothing;",
    "",
    "-- 2. Grant audit:read to accounting + executive",
    "insert into core.role_permission (role_id, permission_id)",
    "select r.id, p.id",
    "from core.role r",
    "cross join core.permission p",
    "where r.key in ('accounting', 'executive')",
    "  and p.key = 'audit:read'",
    "on conflict do nothing;",
    "",
    "-- 3. Grant audit:manage to accounting + executive",
    "insert into core.role_permission (role_id, permission_id)",
    "select r.id, p.id",
    "from core.role r",
    "cross join core.permission p",
    "where r.key in ('accounting', 'executive')",
    "  and p.key = 'audit:manage'",
    "on conflict do nothing;",
    "",
    "-- 4. Verify (run these manually after applying):",
    "-- select p.key from core.permission p where p.key like 'audit:%' order by p.key;",
    "-- select r.key as role, p.key as permission",
    "--   from core.role r",
    "--   join core.role_permission rp on rp.role_id = r.id",
    "--   join core.permission p on p.id = rp.permission_id",
    "--  where r.key in ('accounting','executive') and p.key like 'audit:%'",
    "--  order by r.key, p.key;",
  ])
);

console.log("");
console.log("Done.");
console.log("");
console.log("NEXT STEPS:");
console.log("  1. Apply the SQL migration:");
console.log("     - Option A: paste " + sqlName + " into Supabase SQL editor and run");
console.log("     - Option B: supabase db push  (if you use the CLI)");
console.log("");
console.log("  2. In the browser, log in as an accounting user and open:");
console.log("     /accounting/audit/debug");
console.log("");
console.log("     - If roles[] is empty -> the user has no role assigned.");
console.log("       Fix: insert a row into core.user_role for that user.");
console.log("     - If audit:read is false -> the migration didn't apply, or the");
console.log("       user's role key isn't 'accounting'/'executive'.");
console.log("     - If audit:read is true -> visit /accounting/audit, it will render.");
console.log("");
console.log("  3. Delete the debug page when done:");
console.log("     Remove-Item -Recurse 'src/app/(dashboard)/accounting/audit/debug'");
console.log("");
