// diagnose-import-errors.mjs
// Read-only diagnostic. Does NOT modify any files.
// Usage: node diagnose-import-errors.mjs

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const FILES = [
  "src/components/import/wizard.tsx",
  "src/components/import/import-summary.tsx",
  "src/components/import/validation-summary.tsx",
  "src/lib/import/types.ts",
  "src/lib/import/validate.ts",
  "src/lib/import/commit.ts",
  "src/app/(dashboard)/property/import/actions.ts",
];

console.log("=== Import Error Flow Diagnosis ===\n");

for (const f of FILES) {
  if (!existsSync(f)) {
    console.log("MISSING: " + f);
    continue;
  }
  const src = readFileSync(f, "utf8");
  const lines = src.split(/\r?\n/);

  console.log("--- " + f + " ---");

  // Look for any pattern that could stringify a RowError
  const suspiciousPatterns = [
    { name: "String(...)", re: /String\(/ },
    { name: ".toString()", re: /\.toString\(\)/ },
    { name: "template literal with errors", re: /`[^`]*\$\{[^}]*errors[^}]*\}[^`]*`/ },
    { name: "errors joined", re: /errors\.join\(/ },
    { name: "errors mapped to String", re: /errors\.map\([^)]*String/ },
  ];
  let found = false;
  for (const p of suspiciousPatterns) {
    lines.forEach((line, i) => {
      if (p.re.test(line)) {
        console.log("  [" + p.name + "] line " + (i + 1) + ": " + line.trim());
        found = true;
      }
    });
  }
  if (!found) console.log("  (no stringification patterns found)");

  // Look for error rendering
  const errorRenderLines = [];
  lines.forEach((line, i) => {
    if (/errors\.(map|slice|forEach)/.test(line)) {
      errorRenderLines.push(i);
    }
  });
  if (errorRenderLines.length > 0) {
    console.log("  Error rendering at line(s):");
    for (const li of errorRenderLines) {
      console.log("    line " + (li + 1) + ": " + lines[li].trim());
      // Print the next 4 lines for context
      for (let j = 1; j <= 4 && li + j < lines.length; j++) {
        console.log("      +" + j + ": " + lines[li + j].trim());
      }
    }
  }
  console.log("");
}

// Now scan the types file for RowError shape
const TYPES = "src/lib/import/types.ts";
if (existsSync(TYPES)) {
  console.log("--- RowError definition ---");
  const src = readFileSync(TYPES, "utf8");
  const m = src.match(/RowError[\s\S]{0,300}/);
  if (m) console.log(m[0].split("\n").slice(0, 10).join("\n"));
  else console.log("  (no RowError match)");
  console.log("");
}

console.log("=== End diagnosis ===");
console.log("");
console.log("Next: paste the full output above.");