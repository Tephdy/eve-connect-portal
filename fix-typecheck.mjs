#!/usr/bin/env node
/**
 * fix-typecheck.mjs
 * Automates fixes for common tsc errors:
 *   - TS2322: Map<K, unknown> assigned to string|undefined
 *   - TS1005: ')' expected in supabase query chains
 *
 * Usage:
 *   node fix-typecheck.mjs          # apply fixes
 *   node fix-typecheck.mjs --dry    # preview only
 */

import { readFile, writeFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";

const DRY = process.argv.includes("--dry");
const ROOT = process.cwd();

async function exists(p) {
  try { await access(p, constants.F_OK); return true; } catch { return false; }
}

async function patch(relPath, mutator) {
  const full = resolve(ROOT, relPath);
  if (!(await exists(full))) {
    console.log(`  ! missing: ${relPath}`);
    return;
  }
  const before = await readFile(full, "utf8");
  const after = mutator(before);
  if (after === before) {
    console.log(`  = no change: ${relPath}`);
    return;
  }
  if (DRY) {
    console.log(`  ~ would patch: ${relPath}`);
    return;
  }
  await writeFile(full, after, "utf8");
  console.log(`  + patched: ${relPath}`);
}

// ---------------------------------------------------------------------------
// FIX 1: import/commit.ts — type the Map as <string, string>
// ---------------------------------------------------------------------------

function fixCommitTs(src) {
  let out = src;

  // Pattern: const tenantByName = new Map();  ->  new Map<string, string>()
  out = out.replace(
    /const\s+tenantByName\s*=\s*new\s+Map\s*\(\s*\)/g,
    "const tenantByName = new Map<string, string>()"
  );

  // Pattern: const tenantByName = new Map( ... );  without type args
  out = out.replace(
    /const\s+tenantByName\s*=\s*new\s+Map\s*\((?!\s*<)/g,
    "const tenantByName = new Map<string, string>("
  );

  // If the map is built from Object.entries(...)  the value could be unknown.
  // Coerce the setter to only accept strings:
  out = out.replace(
    /tenantByName\.set\(\s*([^,]+?)\s*,\s*([^)]+?)\s*\)/g,
    (m, k, v) => `tenantByName.set(String(${k}), String(${v}))`
  );

  // Belt-and-braces: narrow at the assignment site (line ~246).
  out = out.replace(
    /if\s*\(\s*!tenantId\s*&&\s*fullName\s*\)\s*tenantId\s*=\s*tenantByName\.get\(\s*fullName\.toLowerCase\(\)\s*\)\s*;?/g,
    [
      "if (!tenantId && fullName) {",
      "  const resolvedTenant = tenantByName.get(fullName.toLowerCase());",
      "  if (typeof resolvedTenant === \"string\") tenantId = resolvedTenant;",
      "}",
    ].join("\n")
  );

  return out;
}

// ---------------------------------------------------------------------------
// FIX 2: audit/rules/deposit-held-too-long.ts — syntax diagnostics
// ---------------------------------------------------------------------------

function diagnoseParens(src) {
  // Strip strings, templates, and comments so we can count brackets safely.
  const cleaned = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "")
    .replace(/`(?:\\.|[^`\\])*`/g, "``")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''");

  let depth = 0;
  let line = 1;
  const stack = [];
  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (ch === "\n") line++;
    if (ch === "(" || ch === "[" || ch === "{") {
      stack.push({ ch, line });
      depth++;
    } else if (ch === ")" || ch === "]" || ch === "}") {
      const open = stack.pop();
      if (!open) {
        return { ok: false, message: `unmatched '${ch}' at line ${line}` };
      }
      depth--;
    }
  }
  if (stack.length) {
    const last = stack[stack.length - 1];
    return {
      ok: false,
      message: `unclosed '${last.ch}' opened at line ${last.line}`,
    };
  }
  return { ok: true };
}

function fixDepositRule(src) {
  const diag = diagnoseParens(src);
  if (!diag.ok) {
    console.log(`    ! ${diag.message}`);
  }

  // Common real-world mistake: `.select(...) .eq(... .in("id", leaseIds);`
  //  - a `.` chain where one call is missing its closing `)`.
  // Heuristic: any line ending in `.in(` or `.eq(` without a `)` after args.
  let out = src;

  // Missing closing paren after `.in("col", value);`
  out = out.replace(
    /(\.in\(\s*["'][^"']+["']\s*,\s*[^)]+?)\s*;/g,
    (m, pre) => (pre.trim().endsWith(")") ? m : `${pre});`)
  );

  // Same for `.eq("col", value);`
  out = out.replace(
    /(\.eq\(\s*["'][^"']+["']\s*,\s*[^)]+?)\s*;/g,
    (m, pre) => (pre.trim().endsWith(")") ? m : `${pre});`)
  );

  return out;
}

// ---------------------------------------------------------------------------
// RUN
// ---------------------------------------------------------------------------

console.log(`\nTypecheck auto-fixer${DRY ? " (dry run)" : ""}\n`);

console.log("Fixing src/lib/import/commit.ts ...");
await patch("src/lib/import/commit.ts", fixCommitTs);

console.log("\nFixing src/lib/audit/rules/deposit-held-too-long.ts ...");
await patch("src/lib/audit/rules/deposit-held-too-long.ts", fixDepositRule);

console.log("\nDone. Re-run: npm run typecheck\n");