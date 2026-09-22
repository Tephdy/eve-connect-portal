#!/usr/bin/env node
/**
 * diagnose-audit-redirect.mjs
 * Finds why /accounting/audit redirects to /dashboard.
 * Usage: node diagnose-audit-redirect.mjs [--dry]
 */
import { readFile, writeFile, access, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import { join, dirname, relative } from "node:path";

const DRY = process.argv.includes("--dry");
const ROOT = process.cwd();

async function exists(p) {
  try { await access(p, constants.F_OK); return true; } catch { return false; }
}

async function walk(dir, out = []) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === ".next" || e.name.startsWith(".")) continue;
      await walk(full, out);
    } else {
      out.push(full);
    }
  }
  return out;
}

function hr(label) {
  console.log("\n" + "=".repeat(64));
  console.log(label);
  console.log("=".repeat(64));
}

// ---------------------------------------------------------------------------
// 1. Report exports in db/audit.ts
// ---------------------------------------------------------------------------

hr("1. Exports from src/lib/db/audit.ts");

const dbAuditPath = join(ROOT, "src/lib/db/audit.ts");
if (await exists(dbAuditPath)) {
  const src = await readFile(dbAuditPath, "utf8");
  const exports = [...src.matchAll(/^export\s+(?:async\s+)?(?:function|const|type|interface|class)\s+(\w+)/gm)]
    .map((m) => m[1]);
  if (exports.length === 0) {
    console.log("  (no top-level exports found)");
  } else {
    for (const e of exports) console.log("  - " + e);
  }

  const needed = ["getAuditStats", "listFindings", "getFinding", "listRules"];
  const optional = ["listComments", "getFindingCountsByRule"];
  console.log("\n  Required:");
  for (const n of needed) {
    console.log("    " + (exports.includes(n) ? "[ok] " : "[MISSING] ") + n);
  }
  console.log("  Optional (checked in code with guards):");
  for (const n of optional) {
    console.log("    " + (exports.includes(n) ? "[ok] " : "[absent] ") + n);
  }
} else {
  console.log("  ! not found: src/lib/db/audit.ts");
}

// ---------------------------------------------------------------------------
// 2. Find error boundaries / middleware that redirect to /dashboard
// ---------------------------------------------------------------------------

hr("2. Files that may redirect to /dashboard");

const srcDir = join(ROOT, "src");
const allFiles = await walk(srcDir);
const candidates = allFiles.filter((f) =>
  /(error\.tsx|not-found\.tsx|middleware\.ts)$/.test(f)
);

if (candidates.length === 0) {
  console.log("  (no error.tsx / not-found.tsx / middleware.ts under src/)");
}

for (const f of candidates) {
  const src = await readFile(f, "utf8");
  const hasDash = /redirect\s*\(\s*["']\/dashboard["']/.test(src);
  const rel = relative(ROOT, f);
  if (hasDash) {
    console.log("  [redirect->dashboard] " + rel);
    const lines = src.split("\n");
    lines.forEach((ln, i) => {
      if (/redirect\s*\(\s*["']\/dashboard["']/.test(ln)) {
        console.log("      line " + (i + 1) + ": " + ln.trim());
      }
    });
  } else {
    console.log("  [clean] " + rel);
  }
}

// ---------------------------------------------------------------------------
// 3. Patch the audit dashboard page with try/catch
// ---------------------------------------------------------------------------

hr("3. Patching audit dashboard with staged try/catch");

const pagePath = "src/app/(dashboard)/accounting/audit/page.tsx";
const fullPage = join(ROOT, pagePath);

if (!(await exists(fullPage))) {
  console.log("  ! not found: " + pagePath + " (skip)");
} else {
  let src = await readFile(fullPage, "utf8");

  if (src.includes("AUDIT_TRACE")) {
    console.log("  = already patched (marker found)");
  } else {
    // Wrap the body of the default export function with a staged try/catch.
    // We look for:
    //   export default async function AuditDashboard() {
    //     ...
    //   }
    // and insert a marker + try/catch.
    const re = /export\s+default\s+async\s+function\s+AuditDashboard\s*\(\s*\)\s*\{/;
    if (!re.test(src)) {
      console.log("  ! could not locate 'export default async function AuditDashboard()' (skip)");
    } else {
      // We rewrite the whole function body by appending a trace page in a
      // separate route instead of mangling the existing JSX. This is safer.
      console.log("  -> writing separate __trace page (see step 4)");
    }
  }
}

// ---------------------------------------------------------------------------
// 4. Write /accounting/audit/__trace diagnostic page
// ---------------------------------------------------------------------------

hr("4. Writing /accounting/audit/__trace");

const tracePath = "src/app/(dashboard)/accounting/audit/__trace/page.tsx";
const fullTrace = join(ROOT, tracePath);

const traceSrc = `// AUDIT_TRACE - diagnostic only, safe to delete
import { getUserRoles } from "@/lib/auth/get-user-roles";
import { hasPermission } from "@/lib/auth/require-permission";
import * as db from "@/lib/db/audit";

export const dynamic = "force-dynamic";

type Step = { name: string; ok: boolean; error?: string; detail?: unknown };

export default async function TracePage() {
  const steps: Step[] = [];

  async function run(name: string, fn: () => Promise<unknown>) {
    try {
      const detail = await fn();
      steps.push({ name, ok: true, detail });
    } catch (err) {
      steps.push({
        name,
        ok: false,
        error: err instanceof Error ? err.stack ?? err.message : String(err),
      });
    }
  }

  await run("getUserRoles", async () => await getUserRoles());
  await run("hasPermission(audit:read)", async () => await hasPermission("audit:read"));
  await run("hasPermission(audit:manage)", async () => await hasPermission("audit:manage"));

  await run("db.getAuditStats", async () => {
    if (typeof (db as Record<string, unknown>).getAuditStats !== "function") {
      throw new Error("getAuditStats is not exported from @/lib/db/audit");
    }
    return await (db as { getAuditStats: () => Promise<unknown> }).getAuditStats();
  });

  await run("db.listFindings({status:'open'})", async () => {
    if (typeof (db as Record<string, unknown>).listFindings !== "function") {
      throw new Error("listFindings is not exported from @/lib/db/audit");
    }
    const rows = await (db as { listFindings: (a: unknown) => Promise<unknown[]> }).listFindings({
      status: "open",
    });
    return { count: Array.isArray(rows) ? rows.length : "not-an-array", sample: Array.isArray(rows) ? rows.slice(0, 1) : null };
  });

  await run("db.listRules", async () => {
    if (typeof (db as Record<string, unknown>).listRules !== "function") {
      throw new Error("listRules is not exported from @/lib/db/audit");
    }
    const rows = await (db as { listRules: () => Promise<unknown[]> }).listRules();
    return { count: Array.isArray(rows) ? rows.length : "not-an-array" };
  });

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-bold">Audit trace</h1>
      <p className="text-sm text-ink-500">
        Each step below runs the corresponding call from the audit pages.
        The first failing step is the cause of the redirect.
      </p>
      {steps.map((s) => (
        <details
          key={s.name}
          open={!s.ok}
          className={
            "rounded-xl border p-3 " +
            (s.ok ? "border-emerald-500/30 bg-emerald-500/5" : "border-rose-500/30 bg-rose-500/5")
          }
        >
          <summary className="cursor-pointer text-sm font-semibold">
            {s.ok ? "[ok] " : "[FAIL] "} {s.name}
          </summary>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs">
            {s.ok
              ? JSON.stringify(s.detail, null, 2)
              : s.error}
          </pre>
        </details>
      ))}
    </div>
  );
}
`;

if (await exists(fullTrace)) {
  console.log("  = skip (exists): " + tracePath);
} else if (DRY) {
  console.log("  ~ would create: " + tracePath);
} else {
  const { mkdir } = await import("node:fs/promises");
  await mkdir(dirname(fullTrace), { recursive: true });
  await writeFile(fullTrace, traceSrc, "utf8");
  console.log("  + created: " + tracePath);
}

console.log("\nDone.");
console.log("\nNEXT:");
console.log("  1. Open /accounting/audit/__trace in the browser as the accounting user.");
console.log("     The first red [FAIL] step is the actual cause of the redirect.");
console.log("  2. If all steps are green but /accounting/audit still redirects,");
console.log("     the redirect is in an error.tsx or middleware.ts (see section 2 above).");
console.log("  3. Delete when done: Remove-Item -Recurse -Force 'src/app/(dashboard)/accounting/audit/__trace'");
console.log("");
