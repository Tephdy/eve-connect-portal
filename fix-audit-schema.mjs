import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const path = resolve(process.cwd(), "src/lib/db/audit.ts");
let src = await readFile(path, "utf8");
const before = src;

// Add `.schema("acct")` where a `.from("audit_*")` chain lacks it.
// Only touches reads/writes on the audit_* tables. Leaves app_user alone.
const tables = ["audit_rule", "audit_finding", "audit_comment", "audit_run"];
for (const t of tables) {
  // Matches `supabase.from("audit_x")` NOT preceded by `.schema("acct")`
  const re = new RegExp(`supabase\\.from\\("${t}"\\)`, "g");
  src = src.replace(re, `supabase.schema("acct").from("${t}")`);
}

// Also catch the case where the client var isn't named `supabase`:
// e.g. `db.from("audit_finding")` — leave this off unless needed.
// The pattern above is safe because your file uses `supabase.from`.

if (src === before) {
  console.log("No changes (already patched, or patterns not matched).");
} else {
  await writeFile(path, src, "utf8");
  const count = (src.match(/supabase\.schema\("acct"\)\.from\("audit_/g) ?? []).length;
  console.log("Patched db/audit.ts — now has " + count + " schema-qualified audit queries.");
}
