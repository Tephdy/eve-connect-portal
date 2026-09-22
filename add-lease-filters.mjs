#!/usr/bin/env node
/**
 * add-lease-filters.mjs
 * Adds search + filters to /property/leases.
 * Creates lease-filters.tsx, extends listLeases(), rewrites page.tsx.
 * Usage: node add-lease-filters.mjs [--dry]
 */
import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import { join, dirname } from "node:path";

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
const j = (lines) => lines.join("\n") + "\n";

// ===========================================================================
// 1. NEW: src/components/lease/lease-filters.tsx
// ===========================================================================

await (async () => {
  const rel = "src/components/lease/lease-filters.tsx";
  const full = join(ROOT, rel);
  if (await exists(full)) { console.log("  = skip (exists) " + rel); return; }

  const src = j([
    '"use client";',
    '',
    'import { useRouter, useSearchParams, usePathname } from "next/navigation";',
    'import { useEffect, useState } from "react";',
    'import { Search, X } from "lucide-react";',
    'import { cn } from "@/lib/utils/cn";',
    '',
    'const STATUSES = [',
    '  { value: "all", label: "All" },',
    '  { value: "active", label: "Active" },',
    '  { value: "expiring", label: "Expiring" },',
    '  { value: "ended", label: "Ended" },',
    '  { value: "terminated", label: "Terminated" },',
    '  { value: "draft", label: "Draft" },',
    '];',
    '',
    'const TERMS = [',
    '  { value: "all", label: "All terms" },',
    '  { value: "1_month", label: "1 month" },',
    '  { value: "3_months", label: "3 months" },',
    '  { value: "6_months", label: "6 months" },',
    '  { value: "1_year", label: "1 year" },',
    '  { value: "2_years", label: "2 years" },',
    '  { value: "3_years", label: "3 years" },',
    '  { value: "other", label: "Other" },',
    '];',
    '',
    'export function LeaseFilters({',
    '  properties,',
    '}: {',
    '  properties: { id: string; name: string }[];',
    '}) {',
    '  const router = useRouter();',
    '  const pathname = usePathname();',
    '  const sp = useSearchParams();',
    '',
    '  const [q, setQ] = useState(sp.get("q") ?? "");',
    '',
    '  const status = sp.get("status") ?? "all";',
    '  const term = sp.get("term") ?? "all";',
    '  const property = sp.get("property") ?? "all";',
    '  const endsBefore = sp.get("ends_before") ?? "";',
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
    '    status !== "all" ||',
    '    term !== "all" ||',
    '    property !== "all" ||',
    '    q.trim() !== "" ||',
    '    endsBefore !== "";',
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
    '            placeholder="Search unit or tenant..."',
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
    '          value={property}',
    '          onChange={(e) => update("property", e.target.value)}',
    '          className="rounded-lg border border-white/60 bg-white/70 px-3 py-1.5 text-sm dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-ink-100"',
    '        >',
    '          <option value="all">All properties</option>',
    '          {properties.map((p) => (',
    '            <option key={p.id} value={p.id}>{p.name}</option>',
    '          ))}',
    '        </select>',
    '',
    '        <select',
    '          value={term}',
    '          onChange={(e) => update("term", e.target.value)}',
    '          className="rounded-lg border border-white/60 bg-white/70 px-3 py-1.5 text-sm dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-ink-100"',
    '        >',
    '          {TERMS.map((t) => (',
    '            <option key={t.value} value={t.value}>{t.label}</option>',
    '          ))}',
    '        </select>',
    '',
    '        <div className="flex items-center gap-1.5 text-xs text-ink-500">',
    '          <span>Ends before</span>',
    '          <input',
    '            type="date"',
    '            value={endsBefore}',
    '            onChange={(e) => update("ends_before", e.target.value)}',
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
    '            onClick={() => update("status", s.value === "all" ? null : s.value)}',
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

  if (DRY) { console.log("  ~ would create " + rel); return; }
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, src, "utf8");
  console.log("  + created " + rel);
})();

// ===========================================================================
// 2. PATCH: src/lib/db/leases.ts — add property_id + filter-aware listLeases
// ===========================================================================

await patchFile("src/lib/db/leases.ts", (src) => {
  let out = src;

  // 2a. Add property fields to Lease type
  if (!out.includes("property_id?:")) {
    out = out.replace(
      /(\n\s*tenant_name\?: string;)/,
      "$1\n  property_id?: string;\n  property_name?: string;"
    );
  }

  // 2b. Replace the entire listLeases function
  const re = /export async function listLeases\(\)[\s\S]*?\n\}/;
  const replacement = j([
    'export type LeaseFilter = {',
    '  status?: "all" | "draft" | "active" | "expiring" | "ended" | "terminated";',
    '  term?: string | "all";',
    '  property_id?: string | "all";',
    '  q?: string;',
    '  ends_before?: string;',
    '};',
    '',
    'export async function listLeases(',
    '  filter: LeaseFilter = {}',
    '): Promise<Lease[]> {',
    '  const supabase = await createClient();',
    '',
    '  let q = supabase',
    '    .from("lease")',
    '    .select(LEASE_SELECT)',
    '    .order("created_at", { ascending: false })',
    '    .limit(1000);',
    '',
    '  if (filter.status && filter.status !== "all") q = q.eq("status", filter.status);',
    '  if (filter.term && filter.term !== "all") q = q.eq("term", filter.term);',
    '',
    '  const { data, error } = await q;',
    '  if (error) throw new Error(error.message);',
    '',
    '  let rows = (data ?? []) as unknown as Lease[];',
    '',
    '  // Property enrichment + filter (cross-schema safe: fetch, filter in JS)',
    '  const unitIds = Array.from(new Set(rows.map((r) => r.unit_id).filter(Boolean)));',
    '  if (unitIds.length > 0) {',
    '    const { data: units } = await supabase',
    '      .from("unit")',
    '      .select("id, property_id")',
    '      .in("id", unitIds);',
    '',
    '    const propertyIds = Array.from(',
    '      new Set((units ?? []).map((u: any) => u.property_id).filter(Boolean))',
    '    );',
    '    const { data: properties } =',
    '      propertyIds.length > 0',
    '        ? await supabase.from("property").select("id, name").in("id", propertyIds)',
    '        : { data: [] as { id: string; name: string }[] };',
    '',
    '    const unitPropMap = new Map((units ?? []).map((u: any) => [u.id, u.property_id]));',
    '    const pMap = new Map((properties ?? []).map((p: any) => [p.id, p.name]));',
    '',
    '    rows.forEach((r) => {',
    '      const propId = unitPropMap.get(r.unit_id) ?? null;',
    '      if (propId) {',
    '        r.property_id = propId as string;',
    '        r.property_name = pMap.get(propId as string) as string | undefined;',
    '      }',
    '    });',
    '  }',
    '',
    '  if (filter.property_id && filter.property_id !== "all") {',
    '    rows = rows.filter((r) => r.property_id === filter.property_id);',
    '  }',
    '',
    '  const needle = filter.q?.trim().toLowerCase();',
    '  if (needle) {',
    '    rows = rows.filter(',
    '      (r) =>',
    '        (r.unit_number ?? "").toLowerCase().includes(needle) ||',
    '        (r.tenant_name ?? "").toLowerCase().includes(needle) ||',
    '        r.id.toLowerCase().includes(needle)',
    '    );',
    '  }',
    '',
    '  if (filter.ends_before) {',
    '    const ts = new Date(filter.ends_before).getTime();',
    '    rows = rows.filter((r) => new Date(r.end_date).getTime() <= ts);',
    '  }',
    '',
    '  return rows;',
    '}',
  ]);

  if (!re.test(out)) {
    console.log("  ! could not find listLeases() — skipping patch");
    return out;
  }
  return out.replace(re, replacement.trimEnd());
});

// ===========================================================================
// 3. REPLACE: src/app/(dashboard)/property/leases/page.tsx
// ===========================================================================

const PAGE_SRC = j([
  'import Link from "next/link";',
  'import { requirePagePermission } from "@/lib/auth/guard";',
  'import { listLeases } from "@/lib/db/leases";',
  'import { listProperties } from "@/lib/db/properties";',
  'import { PageHeader } from "@/components/layout/page-header";',
  'import { EmptyState } from "@/components/layout/empty-state";',
  'import { Button } from "@/components/ui/button";',
  'import { StatCard } from "@/components/dashboard/stat-card";',
  'import { LeaseTable } from "@/components/lease/lease-table";',
  'import { LeaseFilters } from "@/components/lease/lease-filters";',
  '',
  'export default async function LeasesPage({',
  '  searchParams,',
  '}: {',
  '  searchParams: Promise<{',
  '    q?: string;',
  '    status?: string;',
  '    term?: string;',
  '    property?: string;',
  '    ends_before?: string;',
  '  }>;',
  '}) {',
  '  await requirePagePermission("lease:read");',
  '  const sp = await searchParams;',
  '',
  '  const leases = await listLeases({',
  '    status: (sp.status as never) ?? "all",',
  '    term: sp.term ?? "all",',
  '    property_id: sp.property ?? "all",',
  '    q: sp.q ?? "",',
  '    ends_before: sp.ends_before ?? "",',
  '  });',
  '',
  '  // Stats reflect the full set, not the filtered view.',
  '  const all = await listLeases();',
  '  const total = all.length;',
  '  const active = all.filter((l) => l.status === "active").length;',
  '  const expiring = all.filter((l) => l.status === "expiring").length;',
  '  const terminated = all.filter((l) => l.status === "terminated").length;',
  '',
  '  const properties = await listProperties();',
  '',
  '  return (',
  '    <div className="space-y-6">',
  '      <PageHeader',
  '        title="Leases"',
  '        description="All lease agreements."',
  '        action={',
  '          <div className="flex gap-2">',
  '            <Link href="/property/import">',
  '              <Button variant="secondary">Import</Button>',
  '            </Link>',
  '            <Link href="/property/leases/new">',
  '              <Button>+ New Lease</Button>',
  '            </Link>',
  '          </div>',
  '        }',
  '      />',
  '',
  '      {total > 0 && (',
  '        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">',
  '          <StatCard label="Total leases" value={total} accent="brand" />',
  '          <StatCard label="Active" value={active} accent="green" />',
  '          <StatCard label="Expiring" value={expiring} accent="yellow" />',
  '          <StatCard label="Terminated" value={terminated} accent="red" />',
  '        </div>',
  '      )}',
  '',
  '      <LeaseFilters',
  '        properties={properties.map((p) => ({ id: p.id, name: p.name }))}',
  '      />',
  '',
  '      {leases.length === 0 ? (',
  '        <EmptyState',
  '          title="No leases match"',
  '          description="Adjust your filters, or create a new lease."',
  '          action={',
  '            <Link href="/property/leases/new">',
  '              <Button>+ New Lease</Button>',
  '            </Link>',
  '          }',
  '        />',
  '      ) : (',
  '        <LeaseTable leases={leases} />',
  '      )}',
  '    </div>',
  '  );',
  '}',
]);

const fullPage = join(ROOT, "src/app/(dashboard)/property/leases/page.tsx");
if (DRY) { console.log("  ~ would replace page.tsx"); }
else {
  await mkdir(dirname(fullPage), { recursive: true });
  await writeFile(fullPage, PAGE_SRC, "utf8");
  console.log("  + wrote page.tsx");
}

console.log("");
console.log("Done. Next:");
console.log("  1. npm run typecheck");
console.log("  2. npm run dev");
console.log("  3. Open /property/leases — search + filters appear above the table");
console.log("  4. Try: ?q=P1  |  ?status=active  |  ?term=1_year  |  ?property=<uuid>  |  ?ends_before=2027-01-01");
console.log("");
