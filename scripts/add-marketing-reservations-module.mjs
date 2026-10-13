#!/usr/bin/env node
// scripts/add-marketing-reservations-module.mjs
//
// Creates a dedicated /marketing/reservations module, parallel to the
// existing /property/reservations page, and links it in the sidebar +
// mobile bottom nav.
//
// Touches:
//   1. NEW  src/app/(dashboard)/marketing/reservations/page.tsx
//   2.      src/components/shell/sidebar.tsx
//   3.      src/components/shell/mobile-bottom-nav.tsx
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
  page:       "// @@CONTRACT_ENGINE:marketing-reservations-page",
  sidebar:    "// @@CONTRACT_ENGINE:marketing-sidebar-reservations",
  mobileTabs: "// @@CONTRACT_ENGINE:marketing-mobile-tabs",
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

console.log("Marketing reservations module");
console.log("============================");

// ===========================================================================
// 1. NEW src/app/(dashboard)/marketing/reservations/page.tsx
// ===========================================================================
writeOrSkip(
  "src/app/(dashboard)/marketing/reservations/page.tsx",
  `// @@CONTRACT_ENGINE:marketing-reservations-page
import { requirePagePermission } from "@/lib/auth/guard";
import { listReservations } from "@/lib/db/unit-reservations";
import { listProperties } from "@/lib/db/properties";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { EmptyState } from "@/components/layout/empty-state";
import { ReservationTable } from "@/components/accounting/reservation-table";
import { ReservationFilters } from "@/components/accounting/reservation-filters";
import { ReserveUnitButton } from "@/components/property/reserve-unit-button";
import { listUnits } from "@/lib/db/units";
import { listInquiries } from "@/lib/db/inquiries";
import { formatPHP } from "@/lib/utils/format-php";

export default async function MarketingReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; property?: string; verification?: string }>;
}) {
  await requirePagePermission("unit:read");
  const sp = await searchParams;

  const openOnly = (sp.status ?? "active") !== "all";
  const property_id = sp.property ?? "all";
  const verificationFilter = sp.verification ?? "all";

  const [allRows, properties, units, inquiriesAll] = await Promise.all([
    listReservations({ open_only: openOnly, property_id }),
    listProperties(),
    listUnits(),
    listInquiries(),
  ]);

  const rows =
    verificationFilter === "all"
      ? allRows
      : allRows.filter((r) => r.verification_status === verificationFilter);

  const totalFees = rows.reduce(
    (s, r) => s + (Number(r.reservation_fee) || 0),
    0
  );

  const thisMonth = rows.filter((r) => {
    const t = new Date(r.reserved_at);
    const now = new Date();
    return t.getMonth() === now.getMonth() && t.getFullYear() === now.getFullYear();
  }).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reservations"
        description="Unit reservations and fees collected."
        action={<ReserveUnitButton units={units} inquiries={inquiriesAll} />}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Active reservations" value={String(rows.length)} />
        <StatCard label="Fees on hold" value={formatPHP(totalFees)} />
        <StatCard label="Reserved this month" value={String(thisMonth)} />
      </div>

      <ReservationFilters properties={properties} />

      {rows.length === 0 ? (
        <EmptyState
          title="No reservations yet"
          description="Reserve a unit from the Forecast page to get started."
        />
      ) : (
        <ReservationTable rows={rows} />
      )}
    </div>
  );
}
`,
  M.page
);

// ===========================================================================
// 2. sidebar.tsx — add Reservations link under Marketing section
// ===========================================================================
replaceOnce(
  "src/components/shell/sidebar.tsx",
  `      { href: "/marketing/inquiries", label: "Inquiries", icon: MessageSquare, roles: ["marketing", "executive"] },`,
  `      { href: "/marketing/inquiries", label: "Inquiries", icon: MessageSquare, roles: ["marketing", "executive"] },
      // @@CONTRACT_ENGINE:marketing-sidebar-reservations
      { href: "/marketing/reservations", label: "Reservations", icon: KeyRound, roles: ["marketing", "executive"] },`,
  M.sidebar
);

// ===========================================================================
// 3. mobile-bottom-nav.tsx — MARKETING_TABS + wire into tabsForRoles()
// ===========================================================================

// 3a. Insert MARKETING_TABS after MAINTENANCE_TABS
replaceOnce(
  "src/components/shell/mobile-bottom-nav.tsx",
  `const MAINTENANCE_TABS: Tab[] = [
  { key: "jobs",     href: "/maintenance",          label: "Jobs",     icon: Wrench },
  { key: "assets",   href: "/maintenance/assets",   label: "Assets",   icon: Package },
  { key: "calendar", href: "/maintenance/calendar", label: "Calendar", icon: CalendarIcon },
  { key: "more",     label: "More",                 icon: MenuIcon },
];`,
  `const MAINTENANCE_TABS: Tab[] = [
  { key: "jobs",     href: "/maintenance",          label: "Jobs",     icon: Wrench },
  { key: "assets",   href: "/maintenance/assets",   label: "Assets",   icon: Package },
  { key: "calendar", href: "/maintenance/calendar", label: "Calendar", icon: CalendarIcon },
  { key: "more",     label: "More",                 icon: MenuIcon },
];

// @@CONTRACT_ENGINE:marketing-mobile-tabs
const MARKETING_TABS: Tab[] = [
  { key: "home",         href: "/dashboard",               label: "Home",         icon: LayoutDashboard },
  { key: "forecast",     href: "/marketing/forecast",      label: "Forecast",     icon: BarChart3 },
  { key: "reservations", href: "/marketing/reservations",  label: "Reservations", icon: ClipboardCheck },
  { key: "inquiries",    href: "/marketing/inquiries",     label: "Inquiries",    icon: Users },
  { key: "more",         label: "More",                    icon: MenuIcon },
];`,
  M.mobileTabs
);

// 3b. Wire it into tabsForRoles()
replaceOnce(
  "src/components/shell/mobile-bottom-nav.tsx",
  `function tabsForRoles(keys: string[]): Tab[] {
  if (keys.includes("accounting")) return ACCOUNTING_TABS;
  if (keys.includes("executive"))  return EXECUTIVE_TABS;`,
  `function tabsForRoles(keys: string[]): Tab[] {
  // @@CONTRACT_ENGINE:marketing-mobile-tabs
  if (keys.includes("marketing"))   return MARKETING_TABS;
  if (keys.includes("accounting")) return ACCOUNTING_TABS;
  if (keys.includes("executive"))  return EXECUTIVE_TABS;`,
  M.mobileTabs + "-wire"
);

console.log("");
console.log("Done. Next steps:");
console.log("  1. npm run typecheck");
console.log("  2. Login as marketing → sidebar shows Reservations under Marketing");
console.log("  3. Open /marketing/reservations → full list + Reserve button");
console.log("");
console.log("Backups in scripts/.backups/");