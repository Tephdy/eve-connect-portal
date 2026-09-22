#!/usr/bin/env node
import { readFile, writeFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();
async function exists(p) {
  try { await access(p, constants.F_OK); return true; } catch { return false; }
}
async function patch(rel, mutate) {
  const full = resolve(ROOT, rel);
  if (!(await exists(full))) { console.log("  ! missing " + rel); return; }
  const src = await readFile(full, "utf8");
  const out = mutate(src);
  if (out === src) { console.log("  = unchanged " + rel); return; }
  await writeFile(full, out, "utf8");
  console.log("  + patched " + rel);
}

await patch("src/app/(dashboard)/accounting/audit/findings/[id]/page.tsx", (src) => {
  let out = src;
  out = out.replace(/\n\s*breadcrumbs=\{[\s\S]*?\}\n/, "\n");
  out = out.replace(
    /import \{ getFinding \} from "@\/lib\/db\/audit";/,
    'import { getFinding, listComments } from "@/lib/db/audit";'
  );
  out = out.replace(
    /const finding = await getFinding\(params\.id\);\n\s*if \(!finding\) notFound\(\);/,
    [
      'const finding = await getFinding(params.id);',
      '  if (!finding) notFound();',
      '',
      '  const comments =',
      '    typeof listComments === "function"',
      '      ? await listComments(finding.id)',
      '      : [];',
    ].join("\n")
  );
  out = out.replace(
    /<FindingComments findingId=\{finding\.id\} comments=\{finding\.comments \?\? \[\]\} \/>/,
    '<FindingComments findingId={finding.id} comments={comments} />'
  );
  return out;
});

await patch("src/app/(dashboard)/accounting/audit/rules/page.tsx", (src) => {
  let out = src;
  out = out.replace(
    /import \{ listRules \} from "@\/lib\/db\/audit";\nimport \{ getFindingCountsByRule \} from "@\/lib\/db\/audit";/,
    'import { listRules, listFindings } from "@/lib/db/audit";'
  );
  out = out.replace(
    /const \[rules, counts\] = await Promise\.all\(\[\n\s*listRules\(\),\n\s*getFindingCountsByRule\(\),\n\s*\]\);/,
    [
      'const [rules, findings] = await Promise.all([',
      '    listRules(),',
      '    listFindings({ status: "open" }),',
      '  ]);',
      '',
      '  const counts: Record<string, number> = {};',
      '  for (const f of findings) {',
      '    const key = f.rule_key;',
      '    counts[key] = (counts[key] ?? 0) + 1;',
      '  }',
    ].join("\n")
  );
  return out;
});

console.log("\nDone. Run: npm run typecheck\n");
