#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const ABS = join(ROOT, "src/lib/contracts/reservation-attach.ts");
const MARKER = "// @@CONTRACT_ENGINE:blank-slot-as-div";

if (!existsSync(ABS)) { console.error("Missing"); process.exit(1); }
const cur = readFileSync(ABS, "utf8");
if (cur.includes(MARKER)) { console.log("  = already patched"); process.exit(0); }

// Replace the span with a div, and strip the wrapping <p>
const from = `    signatureImage = '<span class="client-signature-blank" aria-hidden="true"></span>';`;
const to = `    // ${MARKER}
    signatureImage = '<div class="client-signature-blank" aria-hidden="true"></div>';`;

if (!cur.includes(from)) {
  console.error("Anchor not found. Showing current span reference:");
  const idx = cur.indexOf("client-signature-blank");
  console.error(cur.slice(idx - 200, idx + 200));
  process.exit(1);
}

// Also strip the prior "wrap span in <p>" cleanup regex so it doesn't leave orphan <p>
const from2 = `    .replace(
      /<p>\\s*<span\\b(?=[^>]*\\bclass=["'][^"']*\\bclient-signature-blank\\b[^"']*["'])[^>]*>\\s*<\\/span>\\s*<\\/p>\\s*/gi,
      ""
    );`;
const to2 = `    .replace(
      /<p>\\s*<span\\b(?=[^>]*\\bclass=["'][^"']*\\bclient-signature-blank\\b[^"']*["'])[^>]*>\\s*<\\/span>\\s*<\\/p>\\s*/gi,
      ""
    )
    .replace(
      /<div\\b(?=[^>]*\\bclass=["'][^"']*\\bclient-signature-blank\\b[^"']*["'])[^>]*>\\s*<\\/div>\\s*/gi,
      ""
    );`;

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const dir = join(ROOT, "scripts", ".backups");
mkdirSync(dir, { recursive: true });
copyFileSync(ABS, join(dir, `reservation-attach.${stamp}.bak`));

let next = cur.replace(from, to);
if (next.includes(from2)) {
  next = next.replace(from2, to2);
}
writeFileSync(ABS, next, "utf8");
console.log("  + blank slot is now a <div> (not <span>)");