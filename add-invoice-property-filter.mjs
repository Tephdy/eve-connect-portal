#!/usr/bin/env node
/**
 * add-invoice-property-filter.mjs
 * Adds "Filter by property" dropdown to /accounting/invoices.
 * - Extends Invoice type with property_id / property_name
 * - Extends enrich() to fetch property_id from units + property names
 * - Extends InvoiceFilter with property_id
 * - Adds property filter in listInvoices (JS side)
 * - Adds Property <select> to InvoiceFilters
 * - Updates page.tsx to fetch properties + read ?property=
 *
 * Usage:
 *   node add-invoice-property-filter.mjs [--dry]
 */
import { readFile, writeFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";

const DRY = process.argv.includes("--dry");
const ROOT = process.cwd();

async function exists(p) {
  try { await access(p, constants.F_OK); return true; } catch { return false; }
}

async function patchFile(rel, mutate) {
  const full = join(ROOT, rel);
  if (!(await exists(full))) { console.log("  ! missing " + rel); return; }
  const before = await readFile(full, "utf8");
  const after = mutate(before);
  if (after === before) { console.log("  = no change " + rel); return; }
  if (DRY) { console.log("  ~ would patch " + rel); return; }
  await writeFile(full, after, "utf8");
  console.log("  + patched " + rel);
}

// ---------------------------------------------------------------------------
// 1. src/lib/db/invoices.ts
// ---------------------------------------------------------------------------

await patchFile("src/lib/db/invoices.ts", (src) => {
  let out = src;

  // 1a. Add property_id / property_name to Invoice type
  if (!out.includes("property_id?:")) {
    out = out.replace(
      /(\n\s*unit_number\?: string;)/,
      "$1\n  property_id?: string;\n  property_name?: string;"
    );
  }

  // 1b. Extend units fetch to include property_id
  out = out.replace(
    /\.select\("id, unit_number"\)\.in\("id", unitIds\)/,
    '.select("id, unit_number, property_id").in("id", unitIds)'
  );

  // 1c. Extend the local unit type annotation in the ternary
  out = out.replace(
    /Promise\.resolve\(\{ data: \[\] as \{ id: string; unit_number: string \}\[\] \}\)/,
    'Promise.resolve({ data: [] as { id: string; unit_number: string; property_id: string | null }[] })'
  );

  // 1d. After uMap is built, add unitPropMap + property fetch + pMap
  if (!out.includes("unitPropMap")) {
    out = out.replace(
      /(\n\s*const uMap = new Map\(\(units \?\? \[\]\)\.map\(\(u\) => \[u\.id, u\.unit_number\]\)\);)/,
      [
        "$1",
        "",
        "  const unitPropMap = new Map(",
        "    (units ?? []).map((u: any) => [u.id, u.property_id as string | null])",
        "  );",
        "  const propertyIds = Array.from(",
        "    new Set((units ?? []).map((u: any) => u.property_id).filter(Boolean))",
        "  );",
        "  const { data: properties } =",
        "    propertyIds.length > 0",
        "      ? await supabase",
        "          .from(\"property\")",
        "          .select(\"id, name\")",
        "          .in(\"id\", propertyIds)",
        "      : { data: [] as { id: string; name: string }[] };",
        "  const pMap = new Map((properties ?? []).map((p: any) => [p.id, p.name]));",
      ].join("\n")
    );
  }

  // 1e. Set property_id and property_name on each row
  if (!out.includes("r.property_id")) {
    out = out.replace(
      /(r\.unit_number = uMap\.get\(l\.unit_id\);)/,
      [
        "$1",
        "      const propId = unitPropMap.get(l.unit_id) ?? null;",
        "      if (propId) {",
        "        r.property_id = propId;",
        "        r.property_name = pMap.get(propId);",
        "      }",
      ].join("\n")
    );
  }

  // 1f. Extend InvoiceFilter type with property_id
  if (!out.includes("property_id?: string | \"all\";")) {
    out = out.replace(
      /(export type InvoiceFilter = \{[\s\S]*?\n\s*to\?: string;)/,
      '$1\n  property_id?: string | "all";'
    );
  }

  // 1g. Apply property filter after enrich()
  if (!out.includes('f.property_id !== "all"')) {
    out = out.replace(
      /(rows = await enrich\(rows\);)/,
      [
        "$1",
        "",
        '  if (f.property_id && f.property_id !== "all") {',
        "    rows = rows.filter((r) => r.property_id === f.property_id);",
        "  }",
      ].join("\n")
    );
  }

  return out;
});

// ---------------------------------------------------------------------------
// 2. src/components/accounting/invoice-filters.tsx
// ---------------------------------------------------------------------------

await patchFile("src/components/accounting/invoice-filters.tsx", (src) => {
  let out = src;

  // 2a. Accept properties prop
  if (!out.includes("properties:")) {
    out = out.replace(
      /export function InvoiceFilters\(\) \{/,
      [
        "export function InvoiceFilters({",
        "  properties,",
        "}: {",
        "  properties: { id: string; name: string }[];",
        "}) {",
      ].join("\n")
    );
  }

  // 2b. Read ?property= from URL
  if (!out.includes('sp.get("property")')) {
    out = out.replace(
      /(const to = sp\.get\("to"\) \?\? "";)/,
      '$1\n  const property = sp.get("property") ?? "all";'
    );
  }

  // 2c. Update hasFilters
  out = out.replace(
    /const hasFilters =\r?\n\s*status !== "all" \|\| type !== "all" \|\| q\.trim\(\) !== "" \|\| from !== "" \|\| to !== "";/,
    'const hasFilters =\n    status !== "all" ||\n    type !== "all" ||\n    property !== "all" ||\n    q.trim() !== "" ||\n    from !== "" ||\n    to !== "";'
  );

  // 2d. Insert Property <select> before the Type <select>
  if (!out.includes("All properties")) {
    out = out.replace(
      /(\s*<select\r?\n\s*value=\{type\})/,
      [
        "",
        "        {/* Property filter */}",
        "        <select",
        "          value={property}",
        '          onChange={(e) => update("property", e.target.value)}',
        '          className="rounded-lg border border-white/60 bg-white/70 px-3 py-1.5 text-sm dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-ink-100"',
        "        >",
        '          <option value="all">All properties</option>',
        "          {properties.map((p) => (",
        "            <option key={p.id} value={p.id}>",
        "              {p.name}",
        "            </option>",
        "          ))}",
        "        </select>",
        "$1",
      ].join("\n")
    );
  }

  return out;
});

// ---------------------------------------------------------------------------
// 3. src/app/(dashboard)/accounting/invoices/page.tsx
// ---------------------------------------------------------------------------

await patchFile("src/app/(dashboard)/accounting/invoices/page.tsx", (src) => {
  let out = src;

  // 3a. Import listProperties
  if (!out.includes("listProperties")) {
    out = out.replace(
      /(import \{ listInvoices \} from "@\/lib\/db\/invoices";)/,
      '$1\nimport { listProperties } from "@/lib/db/properties";'
    );
  }

  // 3b. Add property to searchParams type
  if (!out.includes("property?: string;")) {
    out = out.replace(
      /(searchParams: Promise<\{[\s\S]*?to\?: string;)/,
      "$1\n    property?: string;"
    );
  }

  // 3c. Pass property_id into listInvoices
  if (!out.includes("property_id: sp.property")) {
    out = out.replace(
      /(const invoices = await listInvoices\(\{[\s\S]*?to: sp\.to \?\? "",)/,
      '$1\n    property_id: sp.property ?? "all",'
    );
  }

  // 3d. Fetch properties after the invoice fetch
  if (!out.includes("const properties = await listProperties")) {
    out = out.replace(
      /(const invoices = await listInvoices\(\{[\s\S]*?\}\);)/,
      "$1\n\n  const properties = await listProperties();"
    );
  }

  // 3e. Pass properties into <InvoiceFilters />
  if (!out.includes("<InvoiceFilters properties=")) {
    out = out.replace(
      /<InvoiceFilters \/>/,
      [
        "<InvoiceFilters",
        "        properties={properties.map((p) => ({ id: p.id, name: p.name }))}",
        "      />",
      ].join("\n")
    );
  }

  return out;
});

console.log("");
console.log("Done.");
console.log("");
console.log("Next:");
console.log("  1. npm run typecheck");
console.log("  2. npm run dev");
console.log("  3. Open /accounting/invoices — a Property dropdown should appear");
console.log("  4. Try /accounting/invoices?property=<uuid>");
console.log("");
