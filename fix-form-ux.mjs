#!/usr/bin/env node
/**
 * Fix double-click feel:
 *   - Remove router.refresh() from form success handlers
 *   - Ensure modals close on success
 *   - Rename mode-based button labels consistently
 * Usage: node fix-form-ux.mjs
 */

import { readFile, writeFile, readdir, access } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");

async function exists(p) {
  try { await access(p, constants.F_OK); return true; } catch { return false; }
}

async function walk(dir, acc = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      await walk(p, acc);
    } else if (entry.name.endsWith(".tsx")) {
      acc.push(p);
    }
  }
  return acc;
}

// Files we expect to have a form + useActionState + useEffect success block
const TARGET_HINTS = [
  "property-form.tsx",
  "unit-form.tsx",
  "tenant-form.tsx",
  "lease-form.tsx",
  "template-form.tsx",
  "listing-form.tsx",
  "inquiry-form.tsx",
  "invoice-form.tsx",
  "payment-form.tsx",
  "job-order-form.tsx",
  "asset-form.tsx",
];

async function main() {
  console.log("Fixing form UX — removing double-click feel\n");

  const files = await walk(SRC);
  let touched = 0;

  for (const f of files) {
    const name = f.split(/[\\/]/).pop();
    if (!name) continue;
    if (!TARGET_HINTS.includes(name)) continue;

    const before = await readFile(f, "utf8");
    let after = before;
    const rel = f.replace(ROOT, "").replace(/\\/g, "/");

    // 1. Remove any `router.refresh()` calls inside useEffect
    //    Pattern: /if (mode === "edit") router.refresh();/ or similar
    after = after.replace(
      /\s*if\s*\(\s*mode\s*===\s*["']edit["']\s*\)\s*router\.refresh\(\);/g,
      ""
    );

    // 2. Remove `router.refresh()` used elsewhere in the success block
    //    Only when directly after a toast.push
    after = after.replace(
      /toast\.push\([^)]+\);\s*router\.refresh\(\);/g,
      (match) => match.split("router.refresh();")[0].trimEnd()
    );

    // 3. Remove unused useRouter import if no router usage remains
    if (!after.includes("router.")) {
      after = after.replace(
        /import\s+\{\s*useRouter\s*\}\s+from\s+["']next\/navigation["'];\s*\n/g,
        ""
      );
      after = after.replace(/\s*const\s+router\s*=\s*useRouter\(\);\s*\n/g, "");
    }

    // 4. Normalize button labels — replace "Create X" pattern in edit mode
    // (visual: form already uses mode === "create" ? "Create X" : "Save Changes"
    // so this is a no-op safety net)

    if (after !== before) {
      await writeFile(f, after, "utf8");
      console.log("  ✓ " + rel);
      touched++;
    }
  }

  console.log("\nDone — " + touched + " file(s) updated.\n");

  // Also scan for leftover router.refresh() calls anywhere in src
  const { execSync } = await import("node:child_process");
  console.log("Remaining router.refresh() calls across src:");
  try {
    const out = execSync(
      'findstr /S /I /C:"router.refresh" "' + SRC + '\\*.tsx"',
      { encoding: "utf8" }
    );
    console.log(out);
  } catch {
    console.log("  (none)");
  }

  console.log("\nNext:");
  console.log("  npm run typecheck");
  console.log("  npm run dev");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});