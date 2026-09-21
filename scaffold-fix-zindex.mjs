#!/usr/bin/env node
/**
 * Fix dropdown z-index stacking + remove calendar debug logs
 * Usage: node scaffold-fix-zindex.mjs
 *
 * Updates:
 *   src/app/globals.css                    (header overflow + z-index)
 *   src/components/calendar/aggregate.ts   (remove debug logs)
 */

import { writeFile, readFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

async function exists(p) {
  try { await access(p, constants.F_OK); return true; } catch { return false; }
}

async function main() {
  console.log("Fix: dropdown z-index + calendar log cleanup\n");

  // ---------------------------------------------------------------------------
  // 1. Patch globals.css
  // ---------------------------------------------------------------------------
  const cssPath = join(ROOT, "src/app/globals.css");
  if (!(await exists(cssPath))) {
    console.error("✗ src/app/globals.css not found");
    process.exit(1);
  }

  let css = await readFile(cssPath, "utf8");

  // Match the app-shell block containing .app-header / .app-main
  // Replace the whole block with a fixed version.
  const shellRegex = /\.app-shell\s*\{[\s\S]*?\n\}\s*[\s\S]*?\.app-main\s*\{[^}]*\}/;

  if (shellRegex.test(css)) {
    const replacement = `.app-shell {
  display: grid;
  grid-template-columns: 16rem 1fr;
  grid-template-rows: 4rem 1fr;
  grid-template-areas:
    "sidebar header"
    "sidebar main";
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  isolation: isolate;
}

.app-sidebar {
  grid-area: sidebar;
  overflow: hidden;
}

.app-header {
  grid-area: header;
  overflow: visible;
  position: relative;
  z-index: 30;
}

.app-main {
  grid-area: main;
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
  z-index: 10;
}`;

    css = css.replace(shellRegex, replacement);
    await writeFile(cssPath, css, "utf8");
    console.log("  ~ src/app/globals.css  (header z-index fixed)");
  } else {
    // Fallback: append corrected rules to the end
    css += `

/* ---- Fixed stacking for header dropdowns ---- */
.app-shell { isolation: isolate; }
.app-header {
  overflow: visible !important;
  position: relative !important;
  z-index: 30 !important;
}
.app-main {
  position: relative !important;
  z-index: 10 !important;
}
`;
    await writeFile(cssPath, css, "utf8");
    console.log("  ~ src/app/globals.css  (rules appended — regex didn't match)");
  }

  // ---------------------------------------------------------------------------
  // 2. Strip debug logs from aggregate.ts
  // ---------------------------------------------------------------------------
  const aggPath = join(ROOT, "src/lib/calendar/aggregate.ts");
  if (await exists(aggPath)) {
    let src = await readFile(aggPath, "utf8");
    const before = src.length;

    // Remove single-line console.log that start with "[calendar]"
    src = src.replace(/\n\s*console\.log\("[^"]*\[calendar\][^;]*?\);\n/g, "\n");

    // Remove multi-line console.log / console.error starting with "[calendar]"
    // e.g. console.log(\n  "[calendar] ...",\n  ...args\n);
    src = src.replace(
      /\n\s*console\.(log|error)\(\s*"[^"]*\[calendar\][\s\S]*?\);\n/g,
      "\n"
    );

    // Remove the leftover `if (leaseErr) { console.error(...) ... }` block
    src = src.replace(
      /\n\s*if\s*\(leaseErr\)\s*\{[\s\S]*?\}\n/,
      "\n"
    );

    // Collapse blank lines
    src = src.replace(/\n{3,}/g, "\n\n");

    if (src.length !== before) {
      await writeFile(aggPath, src, "utf8");
      console.log("  ~ src/lib/calendar/aggregate.ts  (removed " + (before - src.length) + " chars of debug logs)");
    } else {
      console.log("  – src/lib/calendar/aggregate.ts  (no debug logs found)");
    }
  } else {
    console.log("  – src/lib/calendar/aggregate.ts not found");
  }

  console.log("\nDone.\n");
  console.log("Next:");
  console.log("  npm run typecheck");
  console.log("  npm run dev");
  console.log("\nVerify:");
  console.log("  1. Click the role pill in the topbar → dropdown appears above content");
  console.log("  2. Click the notification bell → dropdown appears above content");
  console.log("  3. Terminal no longer prints [calendar] logs");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});