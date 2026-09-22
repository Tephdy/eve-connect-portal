#!/usr/bin/env node
/**
 * add-invoice-filters.mjs
 * Adds search + filter UI to /accounting/invoices.
 * Creates invoice-filters.tsx, patches listInvoices, rewrites page.tsx.
 * Idempotent. Dry-run with --dry.
 */
import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import { join, dirname } from "node:path";

const DRY = process.argv.includes("--dry");
const ROOT = process.cwd();

async function exists(p) {
  try { await access(p, constants.F_OK); return true; } catch { return false; }
}

const j = (lines) => lines.join("\n") + "\n";

// ===========================================================================
// 1. NEW: invoice-filters.tsx
// ===========================================================================

const FILTERS_PATH = "src/components/accounting/invoice-filters.tsx";

const FILTERS_SRC = j([
  '"use client";',
  '',
  'import { useRouter, useSearchParams, usePathname } from "next/navigation";',
  'import { useEffect, useState } from "react";',
  'import { Search, X } from "lucide-react";',
  'import { cn } from "@/lib/utils/cn";',
  '',
  'const TYPES = [',
  '  { value: "all", label: "All types" },',
  '  { value: "rent", label: "Rent" },',
  '  { value: "deposit", label: "Deposit" },',
  '  { value: "penalty", label: "Penalty" },',
  '  { value: "other", label: "Other" },',
  '];',
  '',
  'const STATUSES = [',
  '  { value: "all", label: "All" },',
  '  { value: "unpaid", label: "Unpaid" },',
  '  { value: "overdue", label: "Overdue" },',
  '  { value: "paid", label: "Paid" },',
  '  { value: "void", label: "Void" },',
  '];',
  '',
  'export function InvoiceFilters() {',
  '  const router = useRouter();',
  '  const pathname = usePathname();',
  '  const sp = useSearchParams();',
  '',
  '  const [q, setQ] = useState(sp.get("q") ?? "");',
  '',
  '  const status = sp.get("filter") ?? "all";',
  '  const type = sp.get("type") ?? "all";',
  '  const from = sp.get("from") ?? "";',
  '  const to = sp.get("to") ?? "";',
  '',
  '  useEffect(() => {',
  '    const current = sp.get("q") ?? "";',
  '    if (q === current) return;',
  '    const t = setTimeout(() => {',
  '      const params = new URLSearchParams(sp.toString());',
  '      if (q.trim()) params.set("q", q.trim());',
  '      else params.delete("q");',
  '      router.replace(pathname + "?" + params.toString(), { scroll: false });',
  '    }, 300);',
  '    return () => clearTimeout(t);',
  '    // eslint-disable-next-line react-hooks/exhaustive-deps',
  '  }, [q]);',
  '',
  '  function update(key: string, value: string | null) {',
  '    const params = new URLSearchParams(sp.toString());',
  '    if (value && value !== "all" && value !== "") params.set(key, value);',
  '    else params.delete(key);',
  '    router.replace(pathname + "?" + params.toString(), { scroll: false });',
  '  }',
  '',
  '  function clearAll() {',
  '    setQ("");',
  '    router.replace(pathname, { scroll: false });',
  '  }',
  '',
  '  const hasFilters =',
  '    status !== "all" || type !== "all" || q.trim() !== "" || from !== "" || to !== "";',
  '',
  '  return (',
  '    <div className="glass space-y-3 rounded-2xl p-3">',
  '      <div className="flex flex-wrap items-center gap-3">',
  '        <div className="relative min-w-[220px] flex-1">',
  '          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />',
  '          <input',
  '            type="text"',
  '            value={q}',
  '            onChange={(e) => setQ(e.target.value)}',
  '            placeholder="Search invoice no. or tenant..."',
  '            className={cn(',
  '              "w-full rounded-lg border border-white/60 bg-white/70 py-1.5 pl-9 pr-8 text-sm",',
  '              "placeholder:text-ink-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20",',
  '              "dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-ink-100"',
  '            )}',
  '          />',
  '          {q && (',
  '            <button',
  '              type="button"',
  '              onClick={() => setQ("")}',
  '              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-400 hover:text-ink-700"',
  '              aria-label="Clear search"',
  '            >',
  '              <X className="h-3 w-3" />',
  '            </button>',
  '          )}',
  '        </div>',
  '',
  '        <select',
  '          value={type}',
  '          onChange={(e) => update("type", e.target.value)}',
  '          className="rounded-lg border border-white/60 bg-white/70 px-3 py-1.5 text-sm dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-ink-100"',
  '        >',
  '          {TYPES.map((t) => (',
  '            <option key={t.value} value={t.value}>{t.label}</option>',
  '          ))}',
  '        </select>',
  '',
  '        <div className="flex items-center gap-1.5 text-xs text-ink-500">',
  '          <span>Due</span>',
  '          <input',
  '            type="date"',
  '            value={from}',
  '            onChange={(e) => update("from", e.target.value)}',
  '            className="rounded-lg border border-white/60 bg-white/70 px-2 py-1.5 text-xs dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-ink-100"',
  '          />',
  '          <span>\u2192</span>',
  '          <input',
  '            type="date"',
  '            value={to}',
  '            onChange={(e) => update("to", e.target.value)}',
  '            className="rounded-lg border border-white/60 bg-white/70 px-2 py-1.5 text-xs dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-ink-100"',
  '          />',
  '        </div>',
  '',
  '        {hasFilters && (',
  '          <button',
  '            onClick={clearAll}',
  '            className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-medium text-brand-600 transition-colors hover:bg-brand-500/10 dark:text-brand-400"',
  '          >',
  '            <X className="h-3 w-3" />',
  '            Clear all',
  '          </button>',
  '        )}',
  '      </div>',
  '',
  '      <div className="flex flex-wrap items-center gap-1.5">',
  '        <span className="text-xs font-semibold text-ink-500">Status:</span>',
  '        {STATUSES.map((s) => (',
  '          <button',
  '            key={s.value}',
  '            onClick={() => update("filter", s.value === "all" ? null : s.value)}',
  '            className={cn(',
  '              "rounded-lg px-2.5 py-1 text-xs font-semibold capitalize transition-all",',
  '              status === s.value',
  '                ? "bg-brand-gradient text-white shadow-sm shadow-brand-500/30"',
  '                : "text-ink-600 hover:bg-white/60 dark:hover:bg-white/[0.06]"',
  '            )}',
  '          >',
  '            {s.label}',
  '          </button>',
  '        ))}',
  '      </div>',
  '    </div>',
  '  );',
  '}',
]);

// ===========================================================================
// 2. PATCH listInvoices in db/invoices.ts
// ===========================================================================

const DB_PATH = "src/lib/db/invoices.ts";

function patchListInvoices(src) {
  // Match the current single-arg version and replace it entirely.
  const re = /export\s+async\s+function\s+listInvoices\s*\([^)]*\)\s*:\s*Promise<Invoice\[\]>\s*\{[\s\S]*?\n\}/;
  const replacement = j([
    'export type InvoiceFilter = {',
    '  status?: "all" | "unpaid" | "overdue" | "paid" | "void";',
    '  type?: string | "all";',
    '  q?: string;',
    '  from?: string;',
    '  to?: string;',
    '};',
    '',
    'export async function listInvoices(',
    '  filter: InvoiceFilter | "all" | "unpaid" | "overdue" | "paid" | "void" = "all"',
    '): Promise<Invoice[]> {',
    '  const f: InvoiceFilter =',
    '    typeof filter === "string" ? { status: filter } : filter;',
    '',
    '  const supabase = await createClient();',
    '  let q = supabase',
    '    .from("invoice")',
    '    .select("*")',
    '    .order("due_date", { ascending: false })',
    '    .limit(1000);',
    '',
    '  if (f.status && f.status !== "all") q = q.eq("status", f.status);',
    '  if (f.type && f.type !== "all") q = q.eq("type", f.type);',
    '',
    '  const { data, error } = await q;',
    '  if (error) throw new Error(error.message);',
    '',
    '  let rows = (data ?? []) as Invoice[];',
    '',
    '  const needle = f.q?.trim().toLowerCase();',
    '  if (needle) {',
    '    rows = rows.filter(',
    '      (r) =>',
    '        (r.display_number ?? "").toLowerCase().includes(needle) ||',
    '        (r.tenant_name ?? "").toLowerCase().includes(needle) ||',
    '        r.id.toLowerCase().includes(needle)',
    '    );',
    '  }',
    '',
    '  if (f.from) {',
    '    const fromTs = new Date(f.from).getTime();',
    '    rows = rows.filter((r) => new Date(r.due_date).getTime() >= fromTs);',
    '  }',
    '  if (f.to) {',
    '    const toTs = new Date(f.to).getTime();',
    '    rows = rows.filter((r) => new Date(r.due_date).getTime() <= toTs);',
    '  }',
    '',
    '  return rows;',
    '}',
  ]).trimEnd();

  if (!re.test(src)) {
    console.log("  ! could not find listInvoices signature — skipping patch");
    return src;
  }
  return src.replace(re, replacement);
}

// ===========================================================================
// 3. REPLACE page.tsx
// ===========================================================================

const PAGE_PATH = "src/app/(dashboard)/accounting/invoices/page.tsx";

const PAGE_SRC = j([
  'import Link from "next/link";',
  'import { requirePagePermission } from "@/lib/auth/guard";',
  'import { listInvoices } from "@/lib/db/invoices";',
  'import { PageHeader } from "@/components/layout/page-header";',
  'import { EmptyState } from "@/components/layout/empty-state";',
  'import { Button } from "@/components/ui/button";',
  'import { StatCard } from "@/components/dashboard/stat-card";',
  'import { InvoiceTable } from "@/components/accounting/invoice-table";',
  'import { InvoiceFilters } from "@/components/accounting/invoice-filters";',
  'import { formatPHP } from "@/lib/utils/format-php";',
  '',
  'export default async function InvoicesPage({',
  '  searchParams,',
  '}: {',
  '  searchParams: Promise<{',
  '    filter?: string;',
  '    type?: string;',
  '    q?: string;',
  '    from?: string;',
  '    to?: string;',
  '  }>;',
  '}) {',
  '  await requirePagePermission("invoice:read");',
  '  const sp = await searchParams;',
  '',
  '  const status =',
  '    (sp.filter as "all" | "unpaid" | "overdue" | "paid" | "void") ?? "all";',
  '',
  '  const invoices = await listInvoices({',
  '    status,',
  '    type: sp.type ?? "all",',
  '    q: sp.q ?? "",',
  '    from: sp.from ?? "",',
  '    to: sp.to ?? "",',
  '  });',
  '',
  '  const all = await listInvoices("all");',
  '  const unpaid = all.filter((i) => i.status === "unpaid");',
  '  const overdue = all.filter((i) => i.status === "overdue");',
  '  const paid = all.filter((i) => i.status === "paid");',
  '',
  '  const sum = (arr: typeof all) => arr.reduce((s, i) => s + Number(i.amount), 0);',
  '',
  '  return (',
  '    <div className="space-y-6">',
  '      <PageHeader',
  '        title="Invoices"',
  '        description="All invoices with status filters."',
  '        action={',
  '          <Link href="/accounting/invoices/new">',
  '            <Button>+ New Invoice</Button>',
  '          </Link>',
  '        }',
  '      />',
  '',
  '      {all.length > 0 && (',
  '        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">',
  '          <StatCard',
  '            label="Outstanding"',
  '            value={formatPHP(sum(unpaid) + sum(overdue))}',
  '            accent="yellow"',
  '            deltaLabel={unpaid.length + overdue.length + " open"}',
  '          />',
  '          <StatCard',
  '            label="Overdue"',
  '            value={formatPHP(sum(overdue))}',
  '            accent="red"',
  '            deltaLabel={overdue.length + " past due"}',
  '          />',
  '          <StatCard',
  '            label="Paid"',
  '            value={formatPHP(sum(paid))}',
  '            accent="green"',
  '            deltaLabel={paid.length + " settled"}',
  '          />',
  '          <StatCard',
  '            label="Total invoices"',
  '            value={all.length}',
  '            accent="brand"',
  '          />',
  '        </div>',
  '      )}',
  '',
  '      <InvoiceFilters />',
  '',
  '      {invoices.length === 0 ? (',
  '        <EmptyState',
  '          title="No invoices"',
  '          description="No invoices match your filters, or none exist yet."',
  '          action={',
  '            <Link href="/accounting/invoices/new">',
  '              <Button>+ New Invoice</Button>',
  '            </Link>',
  '          }',
  '        />',
  '      ) : (',
  '        <InvoiceTable invoices={invoices} />',
  '      )}',
  '    </div>',
  '  );',
  '}',
]);

// ===========================================================================
// RUN
// ===========================================================================

console.log("\nInvoice filters scaffold" + (DRY ? " (dry run)" : "") + "\n");

// 1. Create InvoiceFilters
const fullFilters = join(ROOT, FILTERS_PATH);
if (await exists(fullFilters)) {
  console.log("  = skip (exists): " + FILTERS_PATH);
} else if (DRY) {
  console.log("  ~ would create: " + FILTERS_PATH);
} else {
  await mkdir(dirname(fullFilters), { recursive: true });
  await writeFile(fullFilters, FILTERS_SRC, "utf8");
  console.log("  + created: " + FILTERS_PATH);
}

// 2. Patch listInvoices
const fullDb = join(ROOT, DB_PATH);
if (!(await exists(fullDb))) {
  console.log("  ! missing: " + DB_PATH);
} else {
  const before = await readFile(fullDb, "utf8");
  const after = patchListInvoices(before);
  if (after === before) {
    console.log("  = no change: " + DB_PATH);
  } else if (DRY) {
    console.log("  ~ would patch: " + DB_PATH);
  } else {
    await writeFile(fullDb, after, "utf8");
    console.log("  + patched: " + DB_PATH);
  }
}

// 3. Replace page.tsx
const fullPage = join(ROOT, PAGE_PATH);
if (DRY) {
  console.log("  ~ would replace: " + PAGE_PATH);
} else {
  await mkdir(dirname(fullPage), { recursive: true });
  await writeFile(fullPage, PAGE_SRC, "utf8");
  console.log("  + wrote: " + PAGE_PATH);
}

console.log("\nDone. Next:");
console.log("  1. Restart dev: npm run dev");
console.log("  2. Open /accounting/invoices");
console.log("  3. Try: ?q=INV-2026-0005  |  ?type=penalty  |  ?filter=paid  |  ?from=2026-09-01&to=2026-09-30");
console.log("");
