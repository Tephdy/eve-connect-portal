import { readFile, writeFile, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";

const root = resolve(process.cwd(), "src/lib/audit");
async function walk(dir, out = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const f = join(dir, e.name);
    if (e.isDirectory()) await walk(f, out);
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(f);
  }
  return out;
}
const files = await walk(root);
const tables = ["audit_rule", "audit_finding", "audit_comment", "audit_run"];
let total = 0;
for (const f of files) {
  let src = await readFile(f, "utf8");
  const before = src;
  for (const t of tables) {
    src = src.replace(
      new RegExp(`supabase\\.from\\("${t}"\\)`, "g"),
      `supabase.schema("acct").from("${t}")`
    );
  }
  if (src !== before) {
    await writeFile(f, src, "utf8");
    total++;
    console.log("  patched: " + f.replace(process.cwd() + "\\", ""));
  }
}
console.log("\n" + total + " file(s) patched.");
