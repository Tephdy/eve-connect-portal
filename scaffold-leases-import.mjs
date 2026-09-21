#!/usr/bin/env node
/**
 * Leases — add Import button to the list page
 * Usage: node scaffold-leases-import.mjs
 *
 * Updates:
 *   src/app/(dashboard)/property/leases/page.tsx  (add Import button)
 */

import { writeFile, readFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

async function exists(p) {
  try { await access(p, constants.F_OK); return true; } catch { return false; }
}

async function main() {
  const path = join(ROOT, "src/app/(dashboard)/property/leases/page.tsx");
  if (!(await exists(path))) {
    console.error("✗ src/app/(dashboard)/property/leases/page.tsx not found");
    process.exit(1);
  }

  const src = await readFile(path, "utf8");

  // Look for the existing action block with "+ New Lease"
  const newLeasePattern =
    /action=\{\s*<Link href="\/property\/leases\/new">\s*<Button>\+ New Lease<\/Button>\s*<\/Link>\s*\}/;

  const replacement = `action={
          <div className="flex gap-2">
            <Link href="/property/import">
              <Button variant="secondary">Import</Button>
            </Link>
            <Link href="/property/leases/new">
              <Button>+ New Lease</Button>
            </Link>
          </div>
        }`;

  if (newLeasePattern.test(src)) {
    const updated = src.replace(newLeasePattern, replacement);
    await writeFile(path, updated, "utf8");
    console.log("  ~ src/app/(dashboard)/property/leases/page.tsx  (added Import button)");
  } else {
    // Fallback: report the current action block for manual patching
    const match = src.match(/action=\{[^}]*\}\s*\/?/);
    console.warn("  ⚠ Could not find the standard action block.");
    console.warn("  Current file fragment:");
    console.warn(match ? match[0] : "(none found)");
    console.warn("");
    console.warn("  Manually replace the action block with:");
    console.warn(replacement);
    process.exit(0);
  }

  console.log("\nDone.\n");
  console.log("Next:");
  console.log("  npm run typecheck");
  console.log("  npm run dev");
  console.log("  Visit /property/leases — you'll see Import + New Lease buttons");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});