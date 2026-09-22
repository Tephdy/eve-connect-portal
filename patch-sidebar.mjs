import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const path = resolve(process.cwd(), "src/components/shell/sidebar.tsx");
let src = await readFile(path, "utf8");
const before = src;

// 1. Add icons to the lucide import if missing
if (!src.includes("ClipboardCheck")) {
  src = src.replace(
    /(\n\s*ShieldCheck,\n)/,
    "$1  ClipboardCheck,\n  GitCompareArrows,\n"
  );
}

// 2. Inject the two Audit items after Approvals
if (!src.includes('href: "/accounting/audit"')) {
  src = src.replace(
    /(\{[^\n]*href:\s*"\/accounting\/approvals"[^\n]*\},\n)/,
    '$1      { href: "/accounting/audit",                label: "Audit",          icon: ClipboardCheck,    roles: ["accounting", "executive"] },\n      { href: "/accounting/audit/reconciliation", label: "Reconciliation", icon: GitCompareArrows, roles: ["accounting", "executive"] },\n'
  );
}

if (src === before) {
  console.log("No changes (already patched, or patterns didn't match).");
} else {
  await writeFile(path, src, "utf8");
  console.log("Patched sidebar.tsx");
}
