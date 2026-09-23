#!/usr/bin/env node
/**
 * fix-calendar-shell-allowedTypes.mjs
 * Normalizes the `allowedTypes` wiring in calendar-shell.tsx to a known-good
 * state, regardless of how many times the previous scripts ran.
 *
 * Strategy: rather than patching fragments, we surgically extract the
 * component signature block and the two fetch param blocks, rewrite them
 * to a canonical form, and reassemble the file.
 *
 * Idempotent. Safe to run multiple times.
 *
 * Usage: node fix-calendar-shell-allowedTypes.mjs [--dry]
 */
import { readFile, writeFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";

const DRY = process.argv.includes("--dry");
const ROOT = process.cwd();
const REL = "src/components/calendar/calendar-shell.tsx";

async function exists(p) {
  try { await access(p, constants.F_OK); return true; } catch { return false; }
}

const full = join(ROOT, REL);
if (!(await exists(full))) {
  console.log("  ! missing: " + REL);
  process.exit(1);
}

let src = await readFile(full, "utf8");
const before = src;

// ---------------------------------------------------------------------------
// STEP 1 — Signature block
// Replace the entire `export function CalendarShell({...}: {...}) {` header
// with a canonical version that has allowedTypes in the right places.
// ---------------------------------------------------------------------------

const CANONICAL_SIGNATURE = `export function CalendarShell({
  initial,
  properties,
  expiringCount,
  expiringDays,
  expiringHref,
  allowedTypes,
}: {
  initial: CalendarMonth;
  properties: { id: string; name: string }[];
  expiringCount: number;
  expiringDays: number;
  expiringHref: string;
  /** Optional: restrict which event types are visible and fetchable. */
  allowedTypes?: CalendarEventType[];
}) {`;

// Match from `export function CalendarShell(` up to and including the first `) {`
// that opens the body. We're careful to only match the header, not the body.
const sigRe =
  /export function CalendarShell\(\s*\{[\s\S]*?\}\s*:\s*\{[\s\S]*?\}\s*\)\s*\{/;

if (!sigRe.test(src)) {
  console.log("  ! could not match CalendarShell signature — aborting");
  process.exit(1);
}
src = src.replace(sigRe, CANONICAL_SIGNATURE);

// ---------------------------------------------------------------------------
// STEP 2 — selectedTypes + effectiveTypes computation
// Replace the whole block from `const typesParam` up to the closing of the
// selectedTypes IIFE. Canonical version.
// ---------------------------------------------------------------------------

const CANONICAL_SELECTED = `const selectedProperty = searchParams.get("property");
  const typesParam = searchParams.get("types") ?? "";
  const selectedTypes: CalendarEventType[] = (() => {
    const fromUrl = typesParam
      ? typesParam
          .split(",")
          .filter((t): t is CalendarEventType =>
            ALL_TYPES.includes(t as CalendarEventType)
          )
      : [];
    if (allowedTypes && allowedTypes.length > 0) {
      if (fromUrl.length === 0) return allowedTypes;
      const filtered = fromUrl.filter((t) => allowedTypes.includes(t));
      return filtered.length > 0 ? filtered : allowedTypes;
    }
    return fromUrl;
  })();

  const effectiveTypes: CalendarEventType[] =
    allowedTypes && allowedTypes.length > 0 ? allowedTypes : ALL_TYPES;`;

const selRe =
  /const selectedProperty = searchParams\.get\("property"\);[\s\S]*?const effectiveTypes: CalendarEventType\[\] =[\s\S]*?ALL_TYPES;/;

if (!selRe.test(src)) {
  console.log("  ! could not match selectedTypes block — aborting");
  process.exit(1);
}
src = src.replace(selRe, CANONICAL_SELECTED);

// ---------------------------------------------------------------------------
// STEP 3 — fetch param blocks
// Find every `if (selectedTypes.length > 0) params.set("types", ...);`
// followed by any number of `else if (allowedTypes...) params.set(...);` and
// collapse to one canonical pair.
// ---------------------------------------------------------------------------

const fetchRe =
  /if \(selectedTypes\.length > 0\)\s*params\.set\("types",\s*selectedTypes\.join\(","\)\);(\s*else if \(allowedTypes && allowedTypes\.length > 0\)\s*params\.set\("types",\s*allowedTypes\.join\(","\)\);)*/g;

const canonicalFetch = `if (selectedTypes.length > 0) params.set("types", selectedTypes.join(","));
    else if (allowedTypes && allowedTypes.length > 0)
      params.set("types", allowedTypes.join(","));`;

const fetchCount = (src.match(fetchRe) || []).length;
if (fetchCount === 0) {
  console.log("  ! no fetch param blocks matched — aborting");
  process.exit(1);
}
src = src.replace(fetchRe, canonicalFetch);

// ---------------------------------------------------------------------------
// STEP 4 — CalendarFilters and Legend JSX passes
// Ensure exactly one `allowedTypes={effectiveTypes}` on each.
// ---------------------------------------------------------------------------

// Remove any duplicates first
src = src.replace(/\s*allowedTypes=\{effectiveTypes\}\s*allowedTypes=\{effectiveTypes\}/g, " allowedTypes={effectiveTypes}");
src = src.replace(/\s*allowedTypes=\{effectiveTypes\}\s*\/>/g, " allowedTypes={effectiveTypes} />");

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

if (src === before) {
  console.log("  = no change — file was already in canonical form");
  process.exit(0);
}
if (DRY) {
  console.log("  ~ would patch: " + REL);
  console.log("    - rewrote signature block");
  console.log("    - rewrote selectedTypes/effectiveTypes block");
  console.log("    - collapsed " + fetchCount + " fetch param block(s)");
  process.exit(0);
}
await writeFile(full, src, "utf8");
console.log("  + patched: " + REL);
console.log("    - rewrote signature block");
console.log("    - rewrote selectedTypes/effectiveTypes block");
console.log("    - collapsed " + fetchCount + " fetch param block(s)");
console.log("");
console.log("Next:");
console.log("  npm run typecheck");
console.log("  npm run dev");
console.log("  Open /marketing/calendar → only Lease ends shown.");
console.log("");