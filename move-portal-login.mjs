// move-portal-login.mjs
// Moves src/app/portal/login/ to src/app/(public)/portal/login/
// so the login page stops inheriting the auth-required portal layout.
//
// URL stays /portal/login because (public) is a route group.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  readdirSync,
  rmdirSync,
} from "node:fs";
import { join } from "node:path";

const SRC_DIR = "src/app/portal/login";
const DST_DIR = "src/app/(public)/portal/login";

const FILES = ["page.tsx", "portal-login-form.tsx"];

console.log("=== move-portal-login.mjs ===\n");

if (!existsSync(SRC_DIR)) {
  console.error("FATAL: " + SRC_DIR + " not found.");
  process.exit(1);
}
if (existsSync(DST_DIR)) {
  console.error("FATAL: " + DST_DIR + " already exists.");
  process.exit(1);
}

mkdirSync(DST_DIR, { recursive: true });

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

// Remove the source dir if empty
try {
  const remaining = readdirSync(SRC_DIR);
  const real = remaining.filter((f) => !f.endsWith(".bak"));
  if (real.length === 0) {
    // Clean up any .bak
    for (const f of remaining) {
      unlinkSync(join(SRC_DIR, f));
      console.log("DELETE " + join(SRC_DIR, f));
    }
    rmdirSync(SRC_DIR);
    console.log("DELETE " + SRC_DIR);
  } else {
    console.log("KEEP   " + SRC_DIR + "  (not empty: " + real.join(", ") + ")");
  }
} catch (e) {
  console.log("KEEP   " + SRC_DIR + "  (" + e.message + ")");
}

console.log("");
console.log("=== Done ===");
console.log("");
console.log("Next:");
console.log("  npm run typecheck");
console.log("  git add .");
console.log('  git commit -m "Move portal/login out of auth-required portal layout"');
console.log("  git push");