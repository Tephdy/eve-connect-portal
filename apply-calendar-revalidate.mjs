// apply-calendar-revalidate.mjs
import { existsSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";

const FILE = "src/app/(dashboard)/property/import/actions.ts";
const NEEDLE = '    revalidatePath("/property/leases");';
const REPLACEMENT = NEEDLE + '\n    revalidatePath("/property/calendar");';

if (!existsSync(FILE)) {
  console.error("MISSING " + FILE);
  process.exit(1);
}

const original = readFileSync(FILE, "utf8");
const NL = original.includes("\r\n") ? "\r\n" : "\n";
let src = original.replace(/\r\n/g, "\n");

if (src.includes('revalidatePath("/property/calendar")')) {
  console.log("SKIP: already patched");
  process.exit(0);
}

if (!src.includes(NEEDLE)) {
  console.error("ABORT: could not find anchor line. Patch manually.");
  process.exit(1);
}

src = src.replace(NEEDLE, REPLACEMENT);

const finalSrc = NL === "\r\n" ? src.replace(/\n/g, "\r\n") : src;
copyFileSync(FILE, FILE + ".bak");
writeFileSync(FILE, finalSrc, "utf8");

console.log("PATCHED " + FILE + "  (backup at .bak)");
console.log("Added: revalidatePath(\"/property/calendar\")");