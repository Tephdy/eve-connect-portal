#!/usr/bin/env node
/**
 * fix-listInvoices-duplicates.mjs
 * Replaces the entire listInvoices function with a single clean version.
 * Also re-applies the InvoiceFilter type with property_id.
 * Usage: node fix-listInvoices-duplicates.mjs [--dry]
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const DRY = process.argv.includes("--dry");
const ROOT = process.cwd();
const FILE = "src/lib/db/invoices.ts";

const src = await readFile(join(ROOT, FILE), "utf8");

const CLEAN_FILTER = [
  "export type InvoiceFilter = {",
  '  status?: "all" | "unpaid" | "overdue" | "paid" | "void";',
  '  type?: string | "all";',
  '  q?: string;',
  "  from?: string;",
  "  to?: string;",
  '  property_id?: string | "all";',
  "};",
].join("\n");

const CLEAN_LIST = [
  "export async function listInvoices(",
  '  filter: InvoiceFilter | "all" | "unpaid" | "overdue" | "paid" | "void" = "all"',
  "): Promise<Invoice[]> {",
  "  const f: InvoiceFilter =",
  '    typeof filter === "string" ? { status: filter } : filter;',
  "",
  "  const supabase = await createClient();",
  "  let q = supabase",
  '    .from("invoice")',
  '    .select("*")',
  '    .order("due_date", { ascending: false })',
  "    .limit(1000);",
  "",
  '  if (f.status && f.status !== "all") q = q.eq("status", f.status);',
  '  if (f.type && f.type !== "all") q = q.eq("type", f.type);',
  "",
  "  const { data, error } = await q;",
  "  if (error) throw new Error(error.message);",
  "",
  "  let rows = (data ?? []) as Invoice[];",
  "  rows = await enrich(rows);",
  "",
  '  if (f.property_id && f.property_id !== "all") {',
  "    rows = rows.filter((r) => r.property_id === f.property_id);",
  "  }",
  "",
  "  const needle = f.q?.trim().toLowerCase();",
  "  if (needle) {",
  "    rows = rows.filter(",
  "      (r) =>",
  '        (r.display_number ?? "").toLowerCase().includes(needle) ||',
  '        (r.tenant_name ?? "").toLowerCase().includes(needle) ||',
  "        r.id.toLowerCase().includes(needle)",
  "    );",
  "  }",
  "",
  "  if (f.from) {",
  "    const fromTs = new Date(f.from).getTime();",
  "    rows = rows.filter((r) => new Date(r.due_date).getTime() >= fromTs);",
  "  }",
  "  if (f.to) {",
  "    const toTs = new Date(f.to).getTime();",
  "    rows = rows.filter((r) => new Date(r.due_date).getTime() <= toTs);",
  "  }",
  "",
  "  return rows;",
  "}",
].join("\n");

let out = src;

// Replace the InvoiceFilter type block
out = out.replace(
  /export type InvoiceFilter = \{[\s\S]*?\n\};/,
  CLEAN_FILTER
);

// Replace the entire listInvoices function
out = out.replace(
  /export async function listInvoices\([\s\S]*?\n\}\n/,
  CLEAN_LIST + "\n"
);

if (out === src) {
  console.log("No changes — patterns didn't match. Paste the current listInvoices to me.");
} else if (DRY) {
  console.log("~ would patch " + FILE);
} else {
  await writeFile(join(ROOT, FILE), out, "utf8");
  console.log("+ patched " + FILE);
}
