#!/usr/bin/env node
// scripts/add-marketing-spreadsheet-module.mjs
//
// Creates a dedicated /marketing/spreadsheet module (mirrors accounting),
// grants report:read to marketing, and links it in the sidebar + mobile nav.
//
// Touches:
//   1. NEW  supabase/migrations/20261013000001_marketing_report_read.sql
//   2. NEW  src/app/(dashboard)/marketing/spreadsheet/page.tsx
//   3. NEW  src/app/(dashboard)/marketing/spreadsheet/export/route.ts
//   4.      src/components/shell/sidebar.tsx
//   5.      src/components/shell/mobile-bottom-nav.tsx
//
// Idempotent, marker-based, backups to scripts/.backups/

import {
  readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const M = {
  migration: "/* @@CONTRACT_ENGINE:marketing-report-read */",
  page:      "// @@CONTRACT_ENGINE:marketing-spreadsheet-page",
  exportR:   "// @@CONTRACT_ENGINE:marketing-spreadsheet-export",
  sidebar:   "// @@CONTRACT_ENGINE:marketing-sidebar-spreadsheet",
  mobile:    "// @@CONTRACT_ENGINE:marketing-mobile-spreadsheet",
};

function backup(abs) {
  if (!existsSync(abs)) return;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = join(ROOT, "scripts", ".backups");
  mkdirSync(dir, { recursive: true });
  copyFileSync(abs, join(dir, `${abs.split(/[\\/]/).pop()}.${stamp}.bak`));
}

function writeOrSkip(rel, body, marker) {
  const abs = join(ROOT, rel);
  mkdirSync(dirname(abs), { recursive: true });
  if (existsSync(abs) && readFileSync(abs, "utf8").includes(marker)) {
    console.log(`  = ${rel} (up to date)`); return;
  }
  backup(abs); writeFileSync(abs, body, "utf8");
  console.log(`  + ${rel} (written)`);
}

function replaceOnce(rel, from, to, marker) {
  const abs = join(ROOT, rel);
  if (!existsSync(abs)) throw new Error(`Missing: ${rel}`);
  const cur = readFileSync(abs, "utf8");
  if (cur.includes(marker)) { console.log(`  = ${rel} (already patched)`); return; }
  if (!cur.includes(from)) throw new Error(`Anchor not found in ${rel}`);
  backup(abs); writeFileSync(abs, cur.replace(from, to), "utf8");
  console.log(`  + ${rel} (patched)`);
}

console.log("Marketing spreadsheet module");
console.log("============================");

// ===========================================================================
// 1. Migration — grant report:read to marketing
// ===========================================================================
writeOrSkip(
  "supabase/migrations/20261013000001_marketing_report_read.sql",
  `-- ---------------------------------------------------------------------------
-- 20261013000001_marketing_report_read.sql
--
-- Grants report:read to the marketing role so they can access the
-- /marketing/spreadsheet module. Idempotent.
-- ---------------------------------------------------------------------------

do $$
declare
  r_marketing uuid;
begin
  select id into r_marketing from core.role where key = 'marketing';
  if r_marketing is null then
    raise exception 'Role "marketing" not found in core.role';
  end if;

  insert into core.role_permission (role_id, permission_id)
  select r_marketing, id from core.permission where key = 'report:read'
  on conflict do nothing;

  raise notice 'Granted report:read to marketing (if not already present).';
end $$;
`,
  M.migration
);

// ===========================================================================
// 2. New page /marketing/spreadsheet
// ===========================================================================
writeOrSkip(
  "src/app/(dashboard)/marketing/spreadsheet/page.tsx",
  `// @@CONTRACT_ENGINE:marketing-spreadsheet-page
import { requirePagePermission } from "@/lib/auth/guard";
import { listProperties } from "@/lib/db/properties";
import { getSpreadsheetRows } from "@/lib/db/spreadsheet";
import { PageHeader } from "@/components/layout/page-header";
import { SpreadsheetTabs } from "@/components/accounting/spreadsheet-tabs";
import { SpreadsheetToolbar } from "@/components/accounting/spreadsheet-toolbar";
import { SpreadsheetGrid } from "@/components/accounting/spreadsheet-grid";

export default async function MarketingSpreadsheetPage({
  searchParams,
}: {
  searchParams: Promise<{ property?: string; month?: string }>;
}) {
  await requirePagePermission("report:read");
  const sp = await searchParams;

  const properties = await listProperties();
  if (properties.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Spreadsheet" description="No properties configured." />
      </div>
    );
  }

  const property_id = sp.property ?? properties[0].id;
  const month = sp.month ?? new Date().toISOString().slice(0, 7);

  const result = await getSpreadsheetRows(property_id, month);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Spreadsheet"
        description="Per-property detail of every active lease, invoice, and payment."
        action={<SpreadsheetToolbar property_id={property_id} />}
      />

      <SpreadsheetTabs
        properties={properties.map((p) => ({ id: p.id, name: p.name }))}
      />

      <SpreadsheetGrid initial={result} property_id={property_id} />
    </div>
  );
}
`,
  M.page
);

// ===========================================================================
// 3. Export route — copy accounting's export route into marketing
//    We read the accounting version at runtime to keep them in sync.
// ===========================================================================
{
  const srcRel = "src/app/(dashboard)/accounting/spreadsheet/export/route.ts";
  const dstRel = "src/app/(dashboard)/marketing/spreadsheet/export/route.ts";
  const srcAbs = join(ROOT, srcRel);
  const dstAbs = join(ROOT, dstRel);

  if (!existsSync(srcAbs)) {
    console.log(`  ! ${srcRel} not found — skipping export route copy`);
  } else {
    mkdirSync(dirname(dstAbs), { recursive: true });
    if (existsSync(dstAbs) && readFileSync(dstAbs, "utf8").includes(M.exportR)) {
      console.log(`  = ${dstRel} (up to date)`);
    } else {
      backup(dstAbs);
      const src = readFileSync(srcAbs, "utf8");
      const body = `${M.exportR}\n// Mirrors ${srcRel}\n${src}`;
      writeFileSync(dstAbs, body, "utf8");
      console.log(`  + ${dstRel} (copied from accounting)`);
    }
  }
}

// ===========================================================================
// 4. sidebar.tsx — add Spreadsheet link under Marketing section
//    Anchor: the Reservations line we previously inserted (unique to Marketing).
// ===========================================================================
replaceOnce(
  "src/components/shell/sidebar.tsx",
  `      { href: "/marketing/reservations", label: "Reservations", icon: KeyRound, roles: ["marketing", "executive"] },`,
  `      { href: "/marketing/reservations", label: "Reservations", icon: KeyRound, roles: ["marketing", "executive"] },
      // @@CONTRACT_ENGINE:marketing-sidebar-spreadsheet
      { href: "/marketing/spreadsheet", label: "Spreadsheet", icon: BarChart3, roles: ["marketing", "executive"] },`,
  M.sidebar
);

// ===========================================================================
// 5. mobile-bottom-nav.tsx — swap Forecast for Spreadsheet in MARKETING_TABS
//    Forecast stays accessible via sidebar / More.
// ===========================================================================
replaceOnce(
  "src/components/shell/mobile-bottom-nav.tsx",
  `const MARKETING_TABS: Tab[] = [
  { key: "home",         href: "/dashboard",               label: "Home",         icon: LayoutDashboard },
  { key: "forecast",     href: "/marketing/forecast",      label: "Forecast",     icon: BarChart3 },
  { key: "reservations", href: "/marketing/reservations",  label: "Reservations", icon: ClipboardCheck },
  { key: "inquiries",    href: "/marketing/inquiries",     label: "Inquiries",    icon: Users },
  { key: "more",         label: "More",                    icon: MenuIcon },
];`,
  `const MARKETING_TABS: Tab[] = [
  // @@CONTRACT_ENGINE:marketing-mobile-spreadsheet
  { key: "home",         href: "/dashboard",               label: "Home",         icon: LayoutDashboard },
  { key: "spreadsheet",  href: "/marketing/spreadsheet",   label: "Sheet",        icon: BarChart3 },
  { key: "reservations", href: "/marketing/reservations",  label: "Reservations", icon: ClipboardCheck },
  { key: "inquiries",    href: "/marketing/inquiries",     label: "Inquiries",    icon: Users },
  { key: "more",         label: "More",                    icon: MenuIcon },
];`,
  M.mobile
);

console.log("");
console.log("Done. Next steps:");
console.log("  1. Apply migration via Supabase SQL Editor:");
console.log("     supabase/migrations/20261013000001_marketing_report_read.sql");
console.log("  2. npm run typecheck");
console.log("  3. Login as marketing → sidebar shows Spreadsheet under Marketing");
console.log("  4. Open /marketing/spreadsheet → full grid + export");
console.log("");
console.log("Backups in scripts/.backups/");