#!/usr/bin/env node
/**
 * remove-gas-utility.mjs
 * Removes the "gas" utility type from the UI, TypeScript types, and
 * (optionally) the database CHECK constraint.
 *
 * Files touched:
 *   - src/components/utilities/meter-filters.tsx       (filter tab list)
 *   - src/components/utilities/add-meter-dialog.tsx    (creation dropdown)
 *   - src/lib/db/utilities.ts                          (UtilityType union)
 *   - src/app/(dashboard)/property/utilities/rates/... (rate dropdown, if any)
 *
 * Prints a SQL snippet at the end to drop "gas" from the CHECK constraint.
 *
 * Usage: node remove-gas-utility.mjs [--dry]
 */
import { readFile, writeFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";

const DRY = process.argv.includes("--dry");
const ROOT = process.cwd();

async function exists(p) {
  try { await access(p, constants.F_OK); return true; } catch { return false; }
}

async function patch(rel, mutate) {
  const full = join(ROOT, rel);
  if (!(await exists(full))) { console.log("  ! missing: " + rel); return; }
  const before = await readFile(full, "utf8");
  const after = mutate(before);
  if (after === before) { console.log("  = no change: " + rel); return; }
  if (DRY) { console.log("  ~ would patch: " + rel); return; }
  await writeFile(full, after, "utf8");
  console.log("  + patched: " + rel);
}

// ---------------------------------------------------------------------------
// 1. Remove gas from any TypeScript array literal that looks like a
//    utility-type list. Matches lines like:
//      { value: "gas", label: "Gas" },
//      { value: 'gas', label: 'Gas' },
//      "gas",
//      'gas',
// ---------------------------------------------------------------------------

function stripGasFromArrays(src) {
  let out = src;

  // Object literal form: { value: "gas", label: "Gas" },
  out = out.replace(
    /\s*\{\s*value:\s*["']gas["']\s*,\s*label:\s*["']Gas["']\s*\},?\r?\n/g,
    "\n"
  );

  // Bare string form: "gas",   or   'gas',
  out = out.replace(
    /\s*["']gas["']\s*,?\r?\n/g,
    "\n"
  );

  // Union type form: "gas" |  or  | "gas"
  out = out.replace(/\s*\|\s*["']gas["']/g, "");
  out = out.replace(/["']gas["']\s*\|\s*/g, "");

  return out;
}

await patch("src/components/utilities/meter-filters.tsx", stripGasFromArrays);
await patch("src/components/utilities/add-meter-dialog.tsx", stripGasFromArrays);
await patch(
  "src/app/(dashboard)/property/utilities/rates/actions.ts",
  stripGasFromArrays
);

// ---------------------------------------------------------------------------
// 2. Utilities type union — handle the specific shape
// ---------------------------------------------------------------------------

await patch("src/lib/db/utilities.ts", (src) => {
  let out = src;
  // UtilityType = "electricity" | "water" | "gas" | "other"
  out = out.replace(
    /export type UtilityType\s*=\s*([^;]+);/,
    (m, union) => {
      const parts = union
        .split("|")
        .map((s) => s.trim())
        .filter((s) => s !== '"gas"' && s !== "'gas'");
      return "export type UtilityType = " + parts.join(" | ") + ";";
    }
  );
  return out;
});

// ---------------------------------------------------------------------------
// 3. Any remaining gas strings in the UI (labels, dropdown options).
// ---------------------------------------------------------------------------

// Find files that still reference "gas" — report them so the user can decide.

console.log("");
console.log("Done with code.");
console.log("");
console.log("NEXT — check for any remaining 'gas' references:");
console.log('  Get-ChildItem -Recurse src -Include *.ts,*.tsx | Select-String -Pattern "gas"');
console.log("");
console.log("If any remain and should be removed, paste that output and I'll patch.");
console.log("");
console.log("DATABASE — the CHECK constraint still allows 'gas'.");
console.log("To disallow it at the DB level, run this in the Supabase SQL editor:");
console.log("");
console.log("  -- Check existing rows for any gas meters (should be zero):");
console.log("  select id, utility_type from acct.meter where utility_type = 'gas';");
console.log("  select id, utility_type from acct.utility_rate where utility_type = 'gas';");
console.log("");
console.log("  -- If both return zero rows, tighten the constraint:");
console.log("  alter table acct.meter drop constraint if exists meter_utility_type_check;");
console.log("  alter table acct.meter add constraint meter_utility_type_check");
console.log("    check (utility_type in ('electricity','water','other'));");
console.log("");
console.log("  alter table acct.utility_rate drop constraint if exists utility_rate_utility_type_check;");
console.log("  alter table acct.utility_rate add constraint utility_rate_utility_type_check");
console.log("    check (utility_type in ('electricity','water','other'));");
console.log("");
console.log("  notify pgrst, 'reload schema';");
console.log("");