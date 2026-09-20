#!/usr/bin/env node
/**
 * Phase 1 — Placeholder pages scaffolder
 * Usage: node scaffold-phase1-placeholders.mjs
 * Run from the project root (where package.json lives).
 *
 * Creates:
 *   src/app/(dashboard)/property/properties/page.tsx
 *   src/app/(dashboard)/property/units/page.tsx
 *   src/app/(dashboard)/property/tenants/page.tsx
 *   src/app/(dashboard)/property/leases/page.tsx
 *   src/app/(dashboard)/property/contracts/page.tsx
 *   src/app/(dashboard)/property/templates/page.tsx
 */

import { mkdir, writeFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import { join, dirname } from "node:path";

// ---------------------------------------------------------------------------
// Placeholder pages: each renders a simple "Coming soon" block.
// ---------------------------------------------------------------------------
const PAGES = {
  "properties": {
    title: "Properties",
    description: "Manage properties in your portfolio — coming soon.",
  },
  "units": {
    title: "Units",
    description: "Manage units across properties — coming soon.",
  },
  "tenants": {
    title: "Tenants",
    description: "Manage tenant records — coming soon.",
  },
  "leases": {
    title: "Leases",
    description: "Manage lease agreements — coming soon.",
  },
  "contracts": {
    title: "Contracts",
    description: "Generate and sign lease contracts — coming soon.",
  },
  "templates": {
    title: "Contract Templates",
    description: "Manage contract templates — coming soon.",
  },
};

function pageContent(title, description) {
  return `export default function Page() {
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-2">${title}</h1>
      <p className="text-gray-600">${description}</p>
    </div>
  );
}
`;
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------
const BASE_DIR = join(
  process.cwd(),
  "src",
  "app",
  "(dashboard)",
  "property"
);

async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  // Sanity check: are we in the project root?
  const pkg = join(process.cwd(), "package.json");
  if (!(await exists(pkg))) {
    console.error("❌ package.json not found. Run this from the project root.");
    process.exit(1);
  }

  // Confirm this is the apartment portal (avoid running in wrong project)
  const pkgText = await import("node:fs/promises").then((fs) =>
    fs.readFile(pkg, "utf8")
  );
  if (!pkgText.includes("\"apartment-portal\"")) {
    console.warn(
      "⚠  package.json name is not 'apartment-portal'. Continue anyway? (Ctrl+C to abort, Enter to proceed)"
    );
    await new Promise((resolve) => process.stdin.once("data", resolve));
  }

  console.log("→ Creating placeholder pages under src/app/(dashboard)/property/\n");

  let created = 0;
  let skipped = 0;

  for (const [slug, { title, description }] of Object.entries(PAGES)) {
    const dir = join(BASE_DIR, slug);
    const file = join(dir, "page.tsx");

    if (await exists(file)) {
      console.log(`  ↻ ${slug}/page.tsx  (exists — overwriting)`);
    } else {
      console.log(`  + ${slug}/page.tsx`);
    }

    await mkdir(dir, { recursive: true });
    await writeFile(file, pageContent(title, description), "utf8");
    created++;
  }

  console.log(`\n✅ Done — ${created} page(s) written, ${skipped} skipped.`);
  console.log("\nNext:");
  console.log("  npm run typecheck");
  console.log("  npm run dev");
  console.log("\nRoutes to test:");
  console.log("  http://localhost:3000/property/properties");
  console.log("  http://localhost:3000/property/units");
  console.log("  http://localhost:3000/property/tenants");
  console.log("  http://localhost:3000/property/leases");
  console.log("  http://localhost:3000/property/contracts");
  console.log("  http://localhost:3000/property/templates");
}

main().catch((err) => {
  console.error("❌ Failed:", err);
  process.exit(1);
});