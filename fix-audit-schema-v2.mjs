import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const path = resolve(process.cwd(), "src/lib/db/audit.ts");
let src = await readFile(path, "utf8");
const before = src;

const tables = ["audit_rule", "audit_finding", "audit_comment", "audit_run"];

// Pattern A: `supabase.from("audit_x")` on the same line (already partly fixed)
for (const t of tables) {
  src = src.replace(
    new RegExp(`supabase\\.from\\("${t}"\\)`, "g"),
    `supabase.schema("acct").from("${t}")`
  );
}

// Pattern B: `await supabase\n  .from("audit_x")` — the multiline split.
// We match `supabase` followed by whitespace + `.from("audit_x")` and inject
// `.schema("acct")` between them. Preserves indentation.
for (const t of tables) {
  src = src.replace(
    new RegExp(`supabase(\\s+)\\.from\\("${t}"\\)`, "g"),
    (m, ws) => `supabase.schema("acct")${ws}.from("${t}")`
  );
}

if (src === before) {
  console.log("No changes (already patched).");
} else {
  await writeFile(path, src, "utf8");
  const qualified = (src.match(/supabase\.schema\("acct"\)/g) ?? []).length;
  console.log("Patched. " + qualified + ' occurrences of .schema("acct") now in file.');
}
