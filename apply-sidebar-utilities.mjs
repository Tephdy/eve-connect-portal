// apply-sidebar-utilities.mjs
// Idempotent patch: adds a Utilities nav group to src/components/shell/sidebar.tsx
// Usage: node apply-sidebar-utilities.mjs
// Safe to re-run. Backs up sidebar.tsx before writing.

import { existsSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";

const FILE = "src/components/shell/sidebar.tsx";

if (!existsSync(FILE)) {
  console.error("MISSING " + FILE);
  process.exit(1);
}

const original = readFileSync(FILE, "utf8");
const NL = original.includes("\r\n") ? "\r\n" : "\n";
let src = original;

// ---------------------------------------------------------------------------
// 0. Detect which line ending the file uses, and work with a normalized copy.
// ---------------------------------------------------------------------------
const normalized = src.replace(/\r\n/g, "\n");

// ---------------------------------------------------------------------------
// 1. Skip if Utilities group already exists.
// ---------------------------------------------------------------------------
if (/label:\s*"Utilities"/.test(normalized)) {
  console.log("SKIP: Utilities group already present in " + FILE);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// 2. Add missing icons to the lucide-react import.
//    We insert each missing icon just before `type LucideIcon` (the last item
//    in the import block), or before the closing `} from "lucide-react"`.
// ---------------------------------------------------------------------------
const REQUIRED_ICONS = ["Gauge", "Droplets", "Zap", "Percent"];
const missingIcons = REQUIRED_ICONS.filter((name) =>
  !new RegExp("\\b" + name + "\\b").test(normalized)
);

let patched = normalized;

if (missingIcons.length > 0) {
  // Anchor 1: insert before `type LucideIcon`
  const anchorA = /\n(\s*)type\s+LucideIcon\s*,?/;
  // Anchor 2: insert before the closing of the import
  const anchorB = /\n(\s*)\}\s*from\s*"lucide-react"/;

  const insertion = missingIcons.map((n) => "  " + n + ",").join("\n");

  if (anchorA.test(patched)) {
    patched = patched.replace(anchorA, (m, indent) => {
      return "\n" + insertion + "\n" + indent + "type LucideIcon,";
    });
  } else if (anchorB.test(patched)) {
    patched = patched.replace(anchorB, (m, indent) => {
      return "\n" + insertion + "\n" + indent + '} from "lucide-react"';
    });
  } else {
    console.error("ABORT: could not locate lucide-react import block.");
    console.error("       Add these manually to the import: " + missingIcons.join(", "));
    process.exit(1);
  }
  console.log("ADD ICONS: " + missingIcons.join(", "));
} else {
  console.log("SKIP ICONS: all required icons already imported");
}

// ---------------------------------------------------------------------------
// 3. Insert the Utilities group.
//    Anchor: the closing of the Property group. We look for the exact
//    `property_rep` role line that ends the Property group, then find the
//    next `},\n  {` that closes that group, and insert after it.
//
//    More robust anchor: search for `label: "Property"` then walk forward
//    to the first `\n  },\n` (end of that group object) and insert after.
// ---------------------------------------------------------------------------
const propertyLabelIdx = patched.search(/label:\s*"Property"\s*,/);
if (propertyLabelIdx === -1) {
  console.error('ABORT: could not find label: "Property" group.');
  process.exit(1);
}

// From there, find the end of the Property group object.
// The group object ends with `\n  },` at 2-space indent (matching GROUPS array).
// We use a regex anchored to two spaces + comma at end-of-line.
const afterProperty = patched.slice(propertyLabelIdx);
const endMatch = afterProperty.match(/\n {2}\},\n/);
if (!endMatch) {
  console.error("ABORT: could not find end of Property group object.");
  process.exit(1);
}

const insertAt = propertyLabelIdx + endMatch.index + endMatch[0].length;

const newGroup =
  "  {\n" +
  '    label: "Utilities",\n' +
  '    roles: ["property_rep", "accounting", "executive"],\n' +
  "    items: [\n" +
  '      { href: "/property/meters",             label: "Meters",   icon: Gauge,    roles: ["property_rep", "accounting", "executive"] },\n' +
  '      { href: "/property/utilities/readings", label: "Readings", icon: Droplets, roles: ["property_rep", "accounting", "executive"] },\n' +
  '      { href: "/property/utilities/billing",  label: "Billing",  icon: Zap,      roles: ["accounting", "executive"] },\n' +
  '      { href: "/property/utilities/rates",    label: "Rates",    icon: Percent,  roles: ["accounting", "executive"] },\n' +
  "    ],\n" +
  "  },\n";

patched = patched.slice(0, insertAt) + newGroup + patched.slice(insertAt);
console.log("ADD GROUP: Utilities (between Property and Marketing)");

// ---------------------------------------------------------------------------
// 4. Restore original line endings, back up, and write.
// ---------------------------------------------------------------------------
const finalSrc = NL === "\r\n" ? patched.replace(/\n/g, "\r\n") : patched;

if (finalSrc === original) {
  console.log("NO CHANGE: file unchanged");
  process.exit(0);
}

copyFileSync(FILE, FILE + ".bak");
writeFileSync(FILE, finalSrc, "utf8");

console.log("");
console.log("WROTE " + FILE + "  (backup at " + FILE + ".bak)");
console.log("");
console.log("Next:");
console.log("  npm run typecheck");
console.log("  npm run dev");
console.log("");
console.log("Rollback:");
console.log('  Copy-Item "' + FILE + '.bak" "' + FILE + '" -Force');