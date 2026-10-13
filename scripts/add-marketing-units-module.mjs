#!/usr/bin/env node
// scripts/add-marketing-units-module.mjs
//
// Creates a dedicated /marketing/units module, parallel to
// /property/units, and links it in the sidebar + mobile bottom nav.
//
// Touches:
//   1. NEW  src/app/(dashboard)/marketing/units/page.tsx
//   2.      src/components/shell/sidebar.tsx
//   3.      src/components/shell/mobile-bottom-nav.tsx (only if not already done)
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
  page:    "// @@CONTRACT_ENGINE:marketing-units-page",
  sidebar: "// @@CONTRACT_ENGINE:marketing-sidebar-units",
  mobile:  "// @@CONTRACT_ENGINE:marketing-mobile-units",
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

console.log("Marketing units module");
console.log("======================");

// ===========================================================================
// 1. NEW src/app/(dashboard)/marketing/units/page.tsx
//    Mirrors /property/units but scoped for marketing — same filters + table,
//    no create/edit buttons (those stay in Property).
// ===========================================================================
writeOrSkip(
  "src/app/(dashboard)/marketing/units/page.tsx",
  `// @@CONTRACT_ENGINE:marketing-units-page
import { requirePagePermission } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { listUnits } from "@/lib/db/units";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { StatCard } from "@/components/dashboard/stat-card";
import { UnitTable } from "@/components/unit/unit-table";
import { UnitFilters } from "@/components/unit/unit-filters";

export default async function MarketingUnitsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    property?: string;
    status?: string;
    bedrooms?: string;
  }>;
}) {
  await requirePagePermission("unit:read");
  const sp = await searchParams;

  const supabase = await createClient();

  const [allUnits, propertiesRes] = await Promise.all([
    listUnits(),
    supabase
      .from("property")
      .select("id, name")
      .is("archived_at", null)
      .order("name"),
  ]);

  const properties = (propertiesRes.data ?? []) as { id: string; name: string }[];

  // ---- Apply filters ----
  const q = (sp.q ?? "").trim().toLowerCase();
  const property = sp.property ?? "";
  const status = sp.status ?? "";
  const bedrooms = sp.bedrooms ?? "";

  const units = allUnits.filter((u) => {
    if (q && !u.unit_number.toLowerCase().includes(q)) return false;
    if (property && u.property_id !== property) return false;
    if (status && u.status !== status) return false;
    if (bedrooms) {
      const b = Number(bedrooms);
      if (Number(u.bedrooms ?? 0) !== b) return false;
    }
    return true;
  });

  // ---- KPI stats (unfiltered) ----
  const total = allUnits.length;
  const vacant = allUnits.filter((u) => u.status === "vacant").length;
  const occupied = allUnits.filter((u) => u.status === "occupied").length;
  const reserved = allUnits.filter((u) => u.status === "reserved").length;

  const bedroomSet = new Set<number>();
  for (const u of allUnits) {
    if (u.bedrooms != null) bedroomSet.add(Number(u.bedrooms));
  }
  const bedroomsOptions = Array.from(bedroomSet).sort((a, b) => a - b);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Units"
        description="Unit inventory across all properties."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard label="Total units" value={String(total)} />
        <StatCard label="Vacant" value={String(vacant)} />
        <StatCard label="Occupied" value={String(occupied)} />
        <StatCard label="Reserved" value={String(reserved)} />
      </div>

      <UnitFilters properties={properties} bedroomsOptions={bedroomsOptions} />

      {units.length === 0 ? (
        <EmptyState
          title="No units match your filters"
          description="Try adjusting the search or filter criteria."
        />
      ) : (
        <UnitTable rows={units} readOnly />
      )}
    </div>
  );
}
`,
  M.page
);

// ===========================================================================
// 2. sidebar.tsx — add Units link under Marketing section
//    Anchored on the Listings line (unique to Marketing section).
// ===========================================================================
replaceOnce(
  "src/components/shell/sidebar.tsx",
  `      { href: "/marketing/listings",  label: "Listings",  icon: Megaphone, roles: ["marketing", "executive"] },`,
  `      { href: "/marketing/listings",  label: "Listings",  icon: Megaphone, roles: ["marketing", "executive"] },
      // @@CONTRACT_ENGINE:marketing-sidebar-units
      { href: "/marketing/units",     label: "Units",     icon: DoorOpen,  roles: ["marketing", "executive"] },`,
  M.sidebar
);

// ===========================================================================
// 3. mobile-bottom-nav.tsx — add Units to MARKETING_TABS
//    Only if the Marketing tabs block already exists from the previous step.
// ===========================================================================
{
  const abs = join(ROOT, "src/components/shell/mobile-bottom-nav.tsx");
  if (!existsSync(abs)) {
    console.log("  ! mobile-bottom-nav.tsx not found, skipping");
  } else {
    const cur = readFileSync(abs, "utf8");
    if (!cur.includes(M.mobile)) {
      if (!cur.includes("const MARKETING_TABS")) {
        console.log("  ! MARKETING_TABS block not present yet, skipping mobile edit");
        console.log("    (run scripts/add-marketing-reservations-module.mjs first)");
      } else if (!cur.includes(`{ key: "units"`)) {
        // Insert Units right after Home in MARKETING_TABS
        replaceOnce(
          "src/components/shell/mobile-bottom-nav.tsx",
          `const MARKETING_TABS: Tab[] = [
  { key: "home",         href: "/dashboard",               label: "Home",         icon: LayoutDashboard },`,
          `const MARKETING_TABS: Tab[] = [
  { key: "home",         href: "/dashboard",               label: "Home",         icon: LayoutDashboard },
  { key: "units",        href: "/marketing/units",         label: "Units",        icon: DoorOpen },
  // @@CONTRACT_ENGINE:marketing-mobile-units`,
          M.mobile
        );
      } else {
        console.log("  = mobile-bottom-nav.tsx (units already present)");
      }
    } else {
      console.log("  = mobile-bottom-nav.tsx (already patched)");
    }
  }
}

console.log("");
console.log("Done. Next steps:");
console.log("  1. npm run typecheck");
console.log("  2. Login as marketing → sidebar shows Units under Marketing");
console.log("  3. Open /marketing/units → list with filters + KPIs");
console.log("");
console.log("Backups in scripts/.backups/");