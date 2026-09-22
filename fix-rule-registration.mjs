#!/usr/bin/env node
/**
 * fix-rule-registration.mjs
 * Finds rule files whose exports aren't in src/lib/audit/rules/index.ts,
 * and (with --apply) inserts the missing imports and RULES entries.
 *
 * Usage:
 *   node fix-rule-registration.mjs           # report only
 *   node fix-rule-registration.mjs --apply   # patch index.ts
 */
import { readFile, writeFile, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";

const APPLY = process.argv.includes("--apply");
const RULES_DIR = resolve(process.cwd(), "src/lib/audit/rules");
const INDEX = join(RULES_DIR, "index.ts");

// ---------------------------------------------------------------------------
// 1. Collect rule files and their exported names + keys
// ---------------------------------------------------------------------------

const files = (await readdir(RULES_DIR)).filter(
  (f) => f.endsWith(".ts") && f !== "index.ts" && f !== "types.ts"
);

const ruleFiles = [];
for (const f of files) {
  const src = await readFile(join(RULES_DIR, f), "utf8");
  const exportMatch = src.match(/export\s+const\s+(\w+)\s*:\s*Rule/);
  const keyMatch = src.match(/key\s*:\s*["']([^"']+)["']/);
  if (exportMatch && keyMatch) {
    ruleFiles.push({
      file: f,
      exportName: exportMatch[1],
      key: keyMatch[1],
    });
  } else {
    console.log("  ! could not parse " + f);
  }
}

console.log("\nFound " + ruleFiles.length + " rule files:\n");
for (const r of ruleFiles) {
  console.log("  " + r.file.padEnd(40) + " export=" + r.exportName.padEnd(28) + " key=" + r.key);
}

// ---------------------------------------------------------------------------
// 2. Read index.ts
// ---------------------------------------------------------------------------

let indexSrc;
try {
  indexSrc = await readFile(INDEX, "utf8");
} catch {
  console.log("\n! src/lib/audit/rules/index.ts not found.");
  process.exit(1);
}

const imports = new Set(
  [...indexSrc.matchAll(/import\s*\{\s*(\w+)\s*\}\s*from\s*["']\.\/([^"']+)["']/g)].map(
    (m) => m[1]
  )
);

const inArray = new Set(
  [...indexSrc.matchAll(/(?:RULES|rules)\s*[:=]\s*\[([\s\S]*?)\]/g)]
    .flatMap((m) => m[1].split(","))
    .map((s) => s.trim().replace(/\/\/.*$/gm, "").trim())
    .filter(Boolean)
);

console.log("\nIndex imports:\n  " + [...imports].join(", "));
console.log("\nIndex RULES array:\n  " + [...inArray].join(", "));

// ---------------------------------------------------------------------------
// 3. Report missing
// ---------------------------------------------------------------------------

const missingImport = [];
const missingInArray = [];
for (const r of ruleFiles) {
  if (!imports.has(r.exportName)) missingImport.push(r);
  if (!inArray.has(r.exportName)) missingInArray.push(r);
}

console.log("\n--- Report ---");
if (missingImport.length === 0 && missingInArray.length === 0) {
  console.log("All rule files are imported and present in RULES.");
  process.exit(0);
}

if (missingImport.length) {
  console.log("\nMissing imports:");
  for (const r of missingImport) {
    console.log("  " + r.exportName + '  from "./' + r.file.replace(/\.ts$/, "") + '"');
  }
}
if (missingInArray.length) {
  console.log("\nMissing from RULES array:");
  for (const r of missingInArray) console.log("  " + r.exportName);
}

if (!APPLY) {
  console.log("\nRun with --apply to patch index.ts.");
  process.exit(0);
}

// ---------------------------------------------------------------------------
// 4. Patch index.ts
// ---------------------------------------------------------------------------

let out = indexSrc;

// Add missing imports after the last existing import line
if (missingImport.length) {
  const lines = out.split("\n");
  let lastImportIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^import\s/.test(lines[i])) lastImportIdx = i;
  }
  const newImports = missingImport.map(
    (r) => `import { ${r.exportName} } from "./${r.file.replace(/\.ts$/, "")}";`
  );
  lines.splice(lastImportIdx + 1, 0, ...newImports);
  out = lines.join("\n");
}

// Add missing exports to RULES array
if (missingInArray.length) {
  const re = /(export\s+const\s+RULES\s*:\s*Rule\[\]\s*=\s*\[)([\s\S]*?)(\])/;
  const m = out.match(re);
  if (!m) {
    console.log("\n! could not locate RULES array declaration. Patch manually.");
    process.exit(1);
  }
  const head = m[1];
  const body = m[2].trimEnd();
  const tail = m[3];
  const additions = missingInArray.map((r) => "  " + r.exportName + ",").join("\n");
  const newBody = body ? body + "\n" + additions : additions;
  out = out.replace(re, head + "\n" + newBody + "\n" + tail);
}

await writeFile(INDEX, out, "utf8");
console.log("\nPatched " + INDEX);
console.log("Restart `npm run dev` and click Run audit.");
