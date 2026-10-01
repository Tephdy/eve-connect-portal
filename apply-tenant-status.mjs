// apply-tenant-status.mjs
// Adds "status" field to the tenants target in src/lib/import/field-defs.ts
// Fail-loud. Verifies write. Rolls back on any mismatch.
// Usage: node apply-tenant-status.mjs

import {
  existsSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  unlinkSync,
} from "node:fs";

const FILE = "src/lib/import/field-defs.ts";

const STATUS_LINE =
  '      { key: "status", label: "Status", required: false, type: "enum", enumValues: ["prospect", "active", "former", "blacklisted"], aliases: ["status", "state", "tenant status"], hint: "prospect, active, former, blacklisted" },';

// The line we insert AFTER. Must appear exactly once in the file,
// and only in the tenants target (not the units or leases targets).
const ANCHOR_FRAGMENT = 'key: "government_id"';

if (!existsSync(FILE)) {
  console.error("FATAL: " + FILE + " not found.");
  process.exit(1);
}

const original = readFileSync(FILE, "utf8");

// ---------- 1. Already applied? ----------
if (original.includes(STATUS_LINE.trim())) {
  console.log("SKIP: status field already present in tenants target.");
  console.log("      No changes made.");
  process.exit(0);
}

// ---------- 2. Locate anchor ----------
const lines = original.split(/\r?\n/);
const anchorIndices = [];
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes(ANCHOR_FRAGMENT)) anchorIndices.push(i);
}

console.log("Found " + anchorIndices.length + " line(s) containing " + JSON.stringify(ANCHOR_FRAGMENT));

if (anchorIndices.length === 0) {
  console.error("");
  console.error("FATAL: anchor not found. Cannot apply patch.");
  console.error("");
  console.error("The anchor fragment is:  " + ANCHOR_FRAGMENT);
  console.error("It should appear in a line like:");
  console.error('  { key: "government_id", label: "Government ID", required: false, type: "text", aliases: [...], },');
  console.error("");
  console.error("Paste this output to diagnose:");
  console.error("  Get-Content \"" + FILE + "\" | Select-String -Pattern 'government_id' -Context 2,2");
  process.exit(1);
}

if (anchorIndices.length > 1) {
  console.error("");
  console.error("FATAL: anchor appears on multiple lines. Ambiguous — refusing to patch.");
  console.error("Line numbers (1-based):");
  for (const i of anchorIndices) console.error("  " + (i + 1) + ": " + lines[i].trim());
  process.exit(1);
}

const anchorIdx = anchorIndices[0];

// ---------- 3. Show context ----------
console.log("");
console.log("Anchor found at line " + (anchorIdx + 1) + " (1-based):");
console.log("  " + lines[anchorIdx]);
console.log("");
console.log("Will insert AFTER this line:");
console.log("  " + STATUS_LINE.trim());
console.log("");

// ---------- 4. Detect line ending and indentation of anchor ----------
const nl = original.includes("\r\n") ? "\r\n" : "\n";
const anchorIndentMatch = lines[anchorIdx].match(/^(\s*)/);
const anchorIndent = anchorIndentMatch ? anchorIndentMatch[1] : "      ";

// STATUS_LINE currently hardcoded with 6 spaces. Re-indent to match anchor.
const statusLineFinal = anchorIndent + STATUS_LINE.trim();

// ---------- 5. Build new file content ----------
const newLines = [
  ...lines.slice(0, anchorIdx + 1),
  statusLineFinal,
  ...lines.slice(anchorIdx + 1),
];
const patched = newLines.join(nl);

// ---------- 6. Write ----------
const backupPath = FILE + ".bak";
copyFileSync(FILE, backupPath);
console.log("Backup written: " + backupPath);

writeFileSync(FILE, patched, "utf8");

// ---------- 7. Verify the write actually happened ----------
const verify = readFileSync(FILE, "utf8");
if (!verify.includes(STATUS_LINE.trim())) {
  console.error("");
  console.error("FATAL: verification failed. The status line is not in the file after write.");
  console.error("Restoring backup...");
  copyFileSync(backupPath, FILE);
  unlinkSync(backupPath);
  console.error("File restored. No changes made.");
  process.exit(1);
}

console.log("");
console.log("SUCCESS. Status field added to tenants target.");
console.log("");
console.log("Next:");
console.log("  1. Restart the dev server (Ctrl+C, then: npm run dev)");
console.log("  2. Hard-refresh /property/import (Ctrl+Shift+R)");
console.log("  3. Select Tenants target — Status should appear between Government ID and Property name");
console.log("");
console.log("Rollback:  Copy-Item \"" + backupPath + "\" \"" + FILE + "\" -Force");