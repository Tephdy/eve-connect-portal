#!/usr/bin/env node
// scripts/marketing-reservations-nav.mjs
//
// Adds "Reservations" to the Marketing sidebar section and wires up a
// dedicated MARKETING_TABS mobile bottom-nav configuration.
//
// Touches:
//   1. src/components/shell/sidebar.tsx
//   2. src/components/shell/mobile-bottom-nav.tsx
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
  sidebarRes:  "// @@CONTRACT_ENGINE:marketing-sidebar-reservations",
  mobileTabs:  "// @@CONTRACT_ENGINE:marketing-mobile-tabs",
};

function backup(abs) {
  if (!existsSync(abs)) return;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = join(ROOT, "scripts", ".backups");
  mkdirSync(dir, { recursive: true });
  copyFileSync(abs, join(dir, `${abs.split(/[\\/]/).pop()}.${stamp}.bak`));
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

console.log("Marketing reservations nav");
console.log("==========================");

// ===========================================================================
// 1. sidebar.tsx — add Reservations to Marketing section
// ===========================================================================
// Anchor: the Marketing group's `items` array. We insert a Reservations
// entry right after the "Forecast" item (which we know exists in the
// marketing section). This is safest because we don't have to match the
// whole group block.
// ===========================================================================
replaceOnce(
  "src/components/shell/sidebar.tsx",
  `      { href: "/marketing/forecast",  label: "Forecast",  icon: TrendingUp, roles: ["marketing"] },`,
  `      { href: "/marketing/forecast",  label: "Forecast",  icon: TrendingUp, roles: ["marketing"] },
      // @@CONTRACT_ENGINE:marketing-sidebar-reservations
      { href: "/property/reservations", label: "Reservations", icon: KeyRound, roles: ["marketing"] },`,
  M.sidebarRes
);

// ===========================================================================
// 2. mobile-bottom-nav.tsx — add MARKETING_TABS + wire into tabsForRoles()
// ===========================================================================

// 2a. Insert MARKETING_TABS block after EXECUTIVE_TABS (or PROPERTY_TABS).
// We anchor on the Property tabs array's closing bracket.
replaceOnce(
  "src/components/shell/mobile-bottom-nav.tsx",
  `  { key: "accounting", href: "/accounting",         label: "Accounting", icon: BarChart3 },
  { key: "audit",      href: "/accounting/audit",   label: "Audit",    icon: ClipboardCheck },
  { key: "more",       label: "More",               icon: MenuIcon },
];`,
  `  { key: "accounting", href: "/accounting",         label: "Accounting", icon: BarChart3 },
  { key: "audit",      href: "/accounting/audit",   label: "Audit",    icon: ClipboardCheck },
  { key: "more",       label: "More",               icon: MenuIcon },
];

// @@CONTRACT_ENGINE:marketing-mobile-tabs
const MARKETING_TABS: Tab[] = [
  { key: "home",         href: "/dashboard",             label: "Home",         icon: LayoutDashboard },
  { key: "forecast",     href: "/marketing/forecast",    label: "Forecast",     icon: TrendingUp },
  { key: "reservations", href: "/property/reservations", label: "Reservations", icon: KeyRound },
  { key: "inquiries",    href: "/marketing/inquiries",   label: "Inquiries",    icon: MessageSquare },
  { key: "more",         label: "More",                  icon: MenuIcon },
];`,
  M.mobileTabs
);

// 2b. Wire it in tabsForRoles()
replaceOnce(
  "src/components/shell/mobile-bottom-nav.tsx",
  `function tabsForRoles(keys: string[]): Tab[] {
  if (keys.includes("accounting")) return ACCOUNTING_TABS;`,
  `function tabsForRoles(keys: string[]): Tab[] {
  // @@CONTRACT_ENGINE:marketing-mobile-tabs
  if (keys.includes("marketing"))   return MARKETING_TABS;
  if (keys.includes("accounting")) return ACCOUNTING_TABS;`,
  M.mobileTabs + "-wire"
);

console.log("");
console.log("Done. Next steps:");
console.log("  1. npm run typecheck");
console.log("  2. Login as a marketing user → sidebar shows Reservations under Marketing");
console.log("  3. Open /property/reservations → full UI with Reserve button");
console.log("");
console.log("Backups in scripts/.backups/");