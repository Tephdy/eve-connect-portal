#!/usr/bin/env node
// Enlarges the signature CSS + adds blank-signature rule.

import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const REL = "src/app/(dashboard)/marketing/reservations/[id]/print/page.tsx";
const ABS = join(ROOT, REL);
const MARKER = "/* @@CONTRACT_ENGINE:bigger-signature-boxes */";

if (!existsSync(ABS)) { console.error("Missing:", REL); process.exit(1); }
const cur = readFileSync(ABS, "utf8");
if (cur.includes(MARKER)) { console.log("  = already patched"); process.exit(0); }

// Multi-line anchor matching the actual layout
const from = `  .rep-signature {
    display: block;
    max-height: 55px;
    width: auto;
    margin: 6px 0 2px 0;
    page-break-inside: avoid;
  }
  .client-signature {
    display: block;
    max-height: 55px;
    width: auto;
    margin: 6px 0 2px 0;
    page-break-inside: avoid;
  }`;

const to = `  ${MARKER}
  .rep-signature,
  .client-signature {
    display: block;
    max-height: 90px;
    min-height: 60px;
    width: auto;
    max-width: 280px;
    margin: 6px 0 2px 0;
    page-break-inside: avoid;
  }

  /* Reserved blank space when unsigned — 260x90 block */
  .client-signature-blank {
    display: block;
    width: 260px;
    height: 90px;
    border-bottom: 1px solid #333;
    margin: 12px 0 8px 0;
    page-break-inside: avoid;
  }`;

if (!cur.includes(from)) {
  console.error("Anchor still not found. Paste this to me for a manual patch:");
  const idx = cur.indexOf(".rep-signature");
  console.error(cur.slice(idx - 50, idx + 400));
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const dir = join(ROOT, "scripts", ".backups");
mkdirSync(dir, { recursive: true });
copyFileSync(ABS, join(dir, `reservation-print.${stamp}.bak`));

writeFileSync(ABS, cur.replace(from, to), "utf8");
console.log("  + CSS enlarged: signature images 90px, blank slot 260x90");
console.log("");
console.log("Next: npm run typecheck, then regenerate + print preview.");