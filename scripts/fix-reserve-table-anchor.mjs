#!/usr/bin/env node
// scripts/fix-reserve-table-anchor.mjs
//
// Corrected anchor for forecast-table.tsx Reserve button.

import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const REL = "src/components/marketing/forecast-table.tsx";
const ABS = join(ROOT, REL);
const MARKER = "// @@CONTRACT_ENGINE:reserve-allow-non-vacant";

if (!existsSync(ABS)) { console.error("Missing:", REL); process.exit(1); }

const src = readFileSync(ABS, "utf8");
if (src.includes(MARKER)) {
  console.log("  = already patched");
  process.exit(0);
}

const from = `                            onClick={() => setReserving(u.id)}
                            disabled={u.status !== "vacant"}
                          >`;
const to   = `                            onClick={() => setReserving(u.id)}
                            // @@CONTRACT_ENGINE:reserve-allow-non-vacant
                            // Allow reserving any unit except already-reserved.
                            disabled={u.status === "reserved"}
                          >`;

if (!src.includes(from)) {
  console.error("Anchor still not found. Paste fresh context.");
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const dir = join(ROOT, "scripts", ".backups");
mkdirSync(dir, { recursive: true });
copyFileSync(ABS, join(dir, `forecast-table.tsx.${stamp}.bak`));

writeFileSync(ABS, src.replace(from, to), "utf8");
console.log("  + forecast-table.tsx patched");