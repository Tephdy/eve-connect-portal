#!/usr/bin/env node
/**
 * Fix TypeScript implicit-type errors in audit + import + calendar files
 * Usage: node fix-audit-types.mjs
 */

import { readFile, writeFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

async function exists(p) {
  try { await access(p, constants.F_OK); return true; } catch { return false; }
}

async function patch(relPath, replacements) {
  const full = join(ROOT, relPath);
  if (!(await exists(full))) {
    console.log("  – skipped " + relPath + " (not found)");
    return 0;
  }
  let src = await readFile(full, "utf8");
  let hits = 0;
  for (const [pattern, replacement] of replacements) {
    const before = src;
    src = src.replace(pattern, replacement);
    if (src !== before) hits++;
  }
  if (hits > 0) {
    await writeFile(full, src, "utf8");
    console.log("  ✓ " + relPath + "  (" + hits + " fix(es))");
  } else {
    console.log("  – " + relPath + "  (no matches, already clean?)");
  }
  return hits;
}

async function main() {
  const pkg = join(ROOT, "package.json");
  if (!(await exists(pkg))) {
    console.error("package.json not found. Run from project root.");
    process.exit(1);
  }

  console.log("Fixing implicit-type errors...\n");

  // -------------------------------------------------------------------------
  // 1. deposit-held-too-long.ts — type the lease map
  // -------------------------------------------------------------------------
  await patch("src/lib/audit/rules/deposit-held-too-long.ts", [
    [
      /const leaseMap = new Map\(\(leases \?\? \[\]\)\.map\(\(l: any\) => \[l\.id, l\]\)\);/,
      'const leaseMap = new Map<string, any>((leases ?? []).map((l: any) => [l.id, l]));'
    ],
  ]);

  // -------------------------------------------------------------------------
  // 2. ledger-mismatch.ts — type reduce params
  // -------------------------------------------------------------------------
  await patch("src/lib/audit/rules/ledger-mismatch.ts", [
    [
      /const totalInvoiced = tenantInvoices\.reduce\(\(s, i: any\) => s \+ Number\(i\.amount \?\? 0\), 0\);/,
      'const totalInvoiced = tenantInvoices.reduce((s: number, i: any) => s + Number(i.amount ?? 0), 0);'
    ],
    [
      /const totalPaid = \(payments \?\? \[\]\)\.reduce\(\(s, p: any\) => s \+ Number\(p\.amount \?\? 0\), 0\);/,
      'const totalPaid = (payments ?? []).reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0);'
    ],
  ]);

  // -------------------------------------------------------------------------
  // 3. payment-before-invoice.ts — type invMap
  // -------------------------------------------------------------------------
  await patch("src/lib/audit/rules/payment-before-invoice.ts", [
    [
      /const invMap = new Map\(\(invoices \?\? \[\]\)\.map\(\(i: any\) => \[i\.id, i\]\)\);/,
      'const invMap = new Map<string, any>((invoices ?? []).map((i: any) => [i.id, i]));'
    ],
  ]);

  // -------------------------------------------------------------------------
  // 4. email-reminders.ts — type userMap
  // -------------------------------------------------------------------------
  await patch("src/lib/calendar/email-reminders.ts", [
    [
      /const userMap = new Map\(\(users \?\? \[\]\)\.map\(\(u: any\) => \[u\.id, u\]\)\);/,
      'const userMap = new Map<string, any>((users ?? []).map((u: any) => [u.id, u]));'
    ],
  ]);

  // -------------------------------------------------------------------------
  // 5. import/commit.ts — type the lookup maps
  // -------------------------------------------------------------------------
  await patch("src/lib/import/commit.ts", [
    [
      /const tenantByEmail = new Map\(\s*\(tenants \?\? \[\]\)\s*\.filter\(\(t: any\) => t\.email\)\s*\.map\(\(t: any\) => \[String\(t\.email\)\.toLowerCase\(\), t\.id\]\)\s*\);/,
      'const tenantByEmail = new Map<string, string>(\n    (tenants ?? [])\n      .filter((t: any) => t.email)\n      .map((t: any) => [String(t.email).toLowerCase(), String(t.id)])\n  );'
    ],
    [
      /const tenantByName = new Map\(\(tenants \?\? \[\]\)\.map\(\(t: any\) => \[String\(t\.full_name\)\.toLowerCase\(\), t\.id\]\)\);/,
      'const tenantByName = new Map<string, string>((tenants ?? []).map((t: any) => [String(t.full_name).toLowerCase(), String(t.id)]));'
    ],
    [
      /const propByName = new Map\(\s*\(properties \?\? \[\]\)\.map\(\(p: any\) => \[p\.name\.toLowerCase\(\), p\.id\]\)\s*\);/,
      'const propByName = new Map<string, string>((properties ?? []).map((p: any) => [String(p.name).toLowerCase(), String(p.id)]));'
    ],
    [
      /const unitByKey = new Map\(\s*\(units \?\? \[\]\)\.map\(\(u: any\) => \[u\.property_id \+ "\|" \+ u\.unit_number, u\.id\]\)\s*\);/,
      'const unitByKey = new Map<string, string>((units ?? []).map((u: any) => [u.property_id + "|" + u.unit_number, String(u.id)]));'
    ],
  ]);

  // -------------------------------------------------------------------------
  // 6. import/validate.ts — type the lookup maps
  // -------------------------------------------------------------------------
  await patch("src/lib/import/validate.ts", [
    [
      /const propByName = new Map\(\s*\(properties \?\? \[\]\)\.map\(\(p: any\) => \[p\.name\.toLowerCase\(\), p\.id\]\)\s*\);/,
      'const propByName = new Map<string, string>((properties ?? []).map((p: any) => [String(p.name).toLowerCase(), String(p.id)]));'
    ],
    [
      /const unitByKey = new Map\(\s*\(units \?\? \[\]\)\.map\(\(u: any\) => \[u\.property_id \+ "\|" \+ u\.unit_number, u\.id\]\)\s*\);/,
      'const unitByKey = new Map<string, string>((units ?? []).map((u: any) => [u.property_id + "|" + u.unit_number, String(u.id)]));'
    ],
    [
      /const tenantByEmail = new Map\(\s*\(tenants \?\? \[\]\)\s*\.filter\(\(t: any\) => t\.email\)\s*\.map\(\(t: any\) => \[String\(t\.email\)\.toLowerCase\(\), t\.id\]\)\s*\);/,
      'const tenantByEmail = new Map<string, string>(\n    (tenants ?? [])\n      .filter((t: any) => t.email)\n      .map((t: any) => [String(t.email).toLowerCase(), String(t.id)])\n  );'
    ],
    [
      /const tenantByName = new Map\(\(tenants \?\? \[\]\)\.map\(\(t: any\) => \[String\(t\.full_name\)\.toLowerCase\(\), t\.id\]\)\);/,
      'const tenantByName = new Map<string, string>((tenants ?? []).map((t: any) => [String(t.full_name).toLowerCase(), String(t.id)]));'
    ],
  ]);

  // -------------------------------------------------------------------------
  // 7. Audit rules — add explicit any annotation on the top-level leases var
  // -------------------------------------------------------------------------
  await patch("src/lib/audit/rules/deposit-held-too-long.ts", [
    [
      /const \{ data: leases \} = await client/,
      'const { data: leases } = (await client'
    ],
  ]);

  console.log("\nDone.\n");
  console.log("Next:");
  console.log("  npm run typecheck");
  console.log("  npm run dev");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});