// move-accept-invite.mjs
// Moves src/app/portal/accept-invite/ to src/app/(public)/portal/accept-invite/
// so the page stops inheriting the auth-required portal layout.
//
// URL stays /portal/accept-invite because (public) is a route group.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  readdirSync,
  rmdirSync,
} from "node:fs";
import { dirname, join, basename } from "node:path";

const SRC_DIR = "src/app/portal/accept-invite";
const DST_DIR = "src/app/(public)/portal/accept-invite";

const FILES = ["page.tsx", "accept-invite-form.tsx", "actions.ts"];

function ensureDir(p) {
  const dir = dirname(p);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

console.log("=== move-accept-invite.mjs ===");
console.log("");

// Sanity checks
if (!existsSync(SRC_DIR)) {
  console.error("FATAL: " + SRC_DIR + " not found.");
  process.exit(1);
}
if (existsSync(DST_DIR)) {
  console.error("FATAL: " + DST_DIR + " already exists.");
  console.error("       Delete it or move the files manually.");
  process.exit(1);
}

ensureDir(DST_DIR);

// Move each known file
for (const name of FILES) {
  const src = join(SRC_DIR, name);
  const dst = join(DST_DIR, name);
  if (!existsSync(src)) {
    console.log("SKIP   " + src + "  (not found)");
    continue;
  }
  const content = readFileSync(src, "utf8");
  writeFileSync(dst, content, "utf8");
  unlinkSync(src);
  console.log("MOVE   " + src + "  →  " + dst);
}

// Cleanup: remove actions.ts.bak if present
const bak = join(SRC_DIR, "actions.ts.bak");
if (existsSync(bak)) {
  unlinkSync(bak);
  console.log("DELETE " + bak);
}

// Remove the empty source directory if we can
try {
  const remaining = readdirSync(SRC_DIR);
  if (remaining.length === 0) {
    rmdirSync(SRC_DIR);
    console.log("DELETE " + SRC_DIR + "  (empty)");
  } else {
    console.log("KEEP   " + SRC_DIR + "  (not empty: " + remaining.join(", ") + ")");
  }
} catch {
  console.log("KEEP   " + SRC_DIR + "  (dir not empty)");
}

console.log("");
console.log("=== Done ===");
console.log("");
console.log("Next:");
console.log("  npm run typecheck");
console.log("  git add .");
console.log('  git commit -m "Move accept-invite out of auth-required portal layout"');
console.log("  git push");
console.log("");
console.log("Then test the invite URL again after Vercel deploys.");