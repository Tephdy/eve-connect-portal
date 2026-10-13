#!/usr/bin/env node
// scripts/setup-contracts.mjs
//
// Idempotent scaffolder for the contract-template engine.
// Run: node scripts/setup-contracts.mjs
//
// Safe to re-run: every step checks for a marker string before writing.
// Backs up every file it touches to scripts/.backups/ before modifying.

import {
  readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const MARKER = {
  types:        "// @@CONTRACT_ENGINE:types",
  control:      "// @@CONTRACT_ENGINE:control-number",
  build:        "// @@CONTRACT_ENGINE:build-context",
  renderStrict: "// @@CONTRACT_ENGINE:render-strict",
  renderFile:   "// @@CONTRACT_ENGINE:render-file",
  intakeHook:   "// @@CONTRACT_ENGINE:intake-hook",
  contractHelp: "// @@CONTRACT_ENGINE:contracts-helpers",
};

function backup(absPath) {
  if (!existsSync(absPath)) return;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = join(ROOT, "scripts", ".backups");
  mkdirSync(dir, { recursive: true });
  copyFileSync(absPath, join(dir, `${absPath.split(/[\\/]/).pop()}.${stamp}.bak`));
}

function writeOrSkip(relPath, contents, marker) {
  const abs = join(ROOT, relPath);
  mkdirSync(dirname(abs), { recursive: true });
  if (existsSync(abs) && readFileSync(abs, "utf8").includes(marker)) {
    console.log(`  = ${relPath} (already up to date)`);
    return;
  }
  backup(abs);
  writeFileSync(abs, contents, "utf8");
  console.log(`  + ${relPath} (written)`);
}

function appendOrSkip(relPath, contents, marker) {
  const abs = join(ROOT, relPath);
  if (!existsSync(abs)) throw new Error(`Missing file: ${relPath}`);
  const cur = readFileSync(abs, "utf8");
  if (cur.includes(marker)) {
    console.log(`  = ${relPath} (patch already applied)`);
    return;
  }
  backup(abs);
  writeFileSync(abs, cur.trimEnd() + "\n\n" + contents + "\n", "utf8");
  console.log(`  + ${relPath} (patched)`);
}

function insertBefore(relPath, anchor, contents, marker) {
  const abs = join(ROOT, relPath);
  if (!existsSync(abs)) throw new Error(`Missing file: ${relPath}`);
  const cur = readFileSync(abs, "utf8");
  if (cur.includes(marker)) {
    console.log(`  = ${relPath} (insert already applied)`);
    return;
  }
  const idx = cur.indexOf(anchor);
  if (idx === -1) throw new Error(`Anchor not found in ${relPath}: ${anchor}`);
  backup(abs);
  writeFileSync(abs, cur.slice(0, idx) + contents + cur.slice(idx), "utf8");
  console.log(`  + ${relPath} (inserted before anchor)`);
}

function replaceOnce(relPath, from, to, marker) {
  const abs = join(ROOT, relPath);
  if (!existsSync(abs)) throw new Error(`Missing file: ${relPath}`);
  const cur = readFileSync(abs, "utf8");
  if (cur.includes(marker)) {
    console.log(`  = ${relPath} (replace already applied)`);
    return;
  }
  const idx = cur.indexOf(from);
  if (idx === -1) throw new Error(`Replace source not found in ${relPath}`);
  backup(abs);
  writeFileSync(abs, cur.replace(from, to), "utf8");
  console.log(`  + ${relPath} (replaced block)`);
}

console.log("Contract-engine scaffolder");
console.log("==========================");

// ===========================================================================
// 1. src/lib/contracts/types.ts
// ===========================================================================
writeOrSkip(
  "src/lib/contracts/types.ts",
  `${MARKER.types}
import type { Database } from "@/types/db";

export type PlaceholderKey =
  // Identity / tenant
  | "legal_name" | "first_name" | "middle_name" | "last_name"
  | "age" | "gender" | "nationality" | "religion" | "civil_status"
  | "perm_address" | "rec_address"
  | "mobile_num" | "email_addr"
  // Employment
  | "company" | "status" | "position" | "comp_addr" | "comp_tel"
  | "comp_email" | "comp_msgr" | "marketing_src"
  // Emergency contacts
  | "ec1_name" | "ec1_tel" | "ec1_email" | "ec1_mssgr"
  | "ec2_name" | "ec2_tel" | "ec2_email" | "ec2_mssgr"
  // Lease / billing
  | "rate" | "occupancy_fee" | "utility_dep" | "sec_dep" | "advance_amount"
  | "advance_due_date" | "deposit_1" | "deposit_2"
  | "deposit_1_due_date" | "deposit_2_due_date"
  | "due_date" | "due_day"
  | "rental_start" | "rental_end" | "move_in_date"
  | "control_number" | "barcode"
  | "term_months"
  // Unit / property
  | "unit_no" | "unit_num" | "property_name" | "property_address"
  // Reservation snapshot
  | "reservation_fee" | "reserv_nonrefundable_on"
  | "deposit_nonrefund_on" | "target_move_in" | "total"
  // Inspection (move-in checklist)
  | "switches" | "switches_com"
  | "sockets" | "sockets_com"
  | "cabinet" | "cabinet_com"
  | "lavatory" | "lavatory_com"
  | "light_bulb" | "light_bulb_com"
  | "faucets" | "faucets_com"
  | "shower_head" | "shower_head_com"
  | "declogging" | "declogging_com"
  | "toilet_bowl" | "toilet_bowl_com"
  | "kitchen_sink" | "kitchen_sink_com"
  | "wall_paint" | "wall_paint_com"
  | "optional" | "optional_com"
  | "doors" | "doors_com"
  | "num_per" | "water" | "electric"
  | "water_initial" | "electric_initial"
  // Meta
  | "current_date" | "date" | "day20" | "rep";

export type ContractContext = {
  // tenant
  legal_name: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  age: string | null;
  gender: string | null;
  nationality: string | null;
  religion: string | null;
  civil_status: string | null;
  perm_address: string | null;
  rec_address: string | null;
  mobile_num: string;
  email_addr: string;
  company: string | null;
  status: string | null;
  position: string | null;
  comp_addr: string | null;
  comp_tel: string | null;
  comp_email: string | null;
  comp_msgr: string | null;
  marketing_src: string | null;
  ec1_name: string | null;
  ec1_tel: string | null;
  ec1_email: string | null;
  ec1_mssgr: string | null;
  ec2_name: string | null;
  ec2_tel: string | null;
  ec2_email: string | null;
  ec2_mssgr: string | null;

  // lease
  rate: string;
  occupancy_fee: string;
  utility_dep: string;
  sec_dep: string;
  advance_amount: string;
  advance_due_date: string;
  deposit_1: string;
  deposit_2: string;
  deposit_1_due_date: string;
  deposit_2_due_date: string;
  due_date: string;
  due_day: number | null;
  rental_start: string;
  rental_end: string;
  move_in_date: string;
  control_number: string;
  barcode: string;
  term_months: string;

  // unit / property
  unit_no: string;
  unit_num: string;
  property_name: string;
  property_address: string | null;

  // reservation snapshot
  reservation_fee: string;
  reserv_nonrefundable_on: string;
  deposit_nonrefund_on: string;
  target_move_in: string;
  total: string;

  // inspection
  switches: string; switches_com: string;
  sockets: string; sockets_com: string;
  cabinet: string; cabinet_com: string;
  lavatory: string; lavatory_com: string;
  light_bulb: string; light_bulb_com: string;
  faucets: string; faucets_com: string;
  shower_head: string; shower_head_com: string;
  declogging: string; declogging_com: string;
  toilet_bowl: string; toilet_bowl_com: string;
  kitchen_sink: string; kitchen_sink_com: string;
  wall_paint: string; wall_paint_com: string;
  optional: string; optional_com: string;
  doors: string; doors_com: string;
  num_per: string;
  water: string;
  electric: string;
  water_initial: string;
  electric_initial: string;

  // meta
  current_date: string;
  date: string;
  day20: string;
  rep: string;
};

export type BuildContractContextInput = {
  leaseId: string;
  repName?: string | null;
};

export type ContractTemplateRow =
  Database["prep"]["Tables"]["contract_template"]["Row"];
`,
  MARKER.types
);

// ===========================================================================
// 2. src/lib/contracts/control-number.ts
// ===========================================================================
writeOrSkip(
  "src/lib/contracts/control-number.ts",
  `${MARKER.control}
import "server-only";

export type ControlNumberInput = {
  prefix?: string | null;
  year?: number;
  sequence: number;
};

export function formatControlNumber(input: ControlNumberInput): string {
  const prefix =
    (input.prefix ?? "EVE").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) ||
    "EVE";
  const year = input.year ?? new Date().getFullYear();
  const seq = Math.max(1, Math.floor(input.sequence));
  return \`\${prefix}-\${year}-\${String(seq).padStart(5, "0")}\`;
}

export function barcodeValueFor(controlNumber: string): string {
  return controlNumber.replace(/\\s+/g, "").toUpperCase();
}
`,
  MARKER.control
);

// ===========================================================================
// 3. src/lib/contracts/build-context.ts
// ===========================================================================
writeOrSkip(
  "src/lib/contracts/build-context.ts",
  `${MARKER.build}
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  BuildContractContextInput,
  ContractContext,
  PlaceholderKey,
} from "./types";

const PHP = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatPhp(amount: number | null | undefined): string {
  return PHP.format(Number(amount) || 0);
}

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

export function formatDate(input: string | Date | null | undefined): string {
  if (!input) return "";
  const d = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return "";
  return \`\${MONTHS[d.getMonth()]} \${d.getDate()}, \${d.getFullYear()}\`;
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function s(v: unknown): string {
  return v == null ? "" : String(v);
}

export async function buildContractContext(
  input: BuildContractContextInput
): Promise<ContractContext> {
  const admin = createAdminClient();

  const { data: lease, error: leaseErr } = await admin
    .schema("core")
    .from("lease")
    .select(
      "id, tenant_id, unit_id, start_date, end_date, move_in_date, " +
      "monthly_rent, occupancy_fee, utility_deposit, " +
      "advance_amount, advance_due_date, " +
      "deposit_amount, deposit_1, deposit_2, " +
      "deposit_1_due_date, deposit_2_due_date, " +
      "due_date, due_day, control_number, barcode_value, " +
      "reservation_fee, reservation_fee_nonrefundable_on, " +
      "deposit_nonrefundable_on, target_move_in_date, reservation_total_due, " +
      "term, term_label, term_months"
    )
    .eq("id", input.leaseId)
    .single();

  if (leaseErr || !lease) {
    throw new Error(
      "buildContractContext: lease not found — " +
        (leaseErr?.message ?? input.leaseId)
    );
  }

  const { data: tenant, error: tenantErr } = await admin
    .schema("core")
    .from("tenant")
    .select("*")
    .eq("id", lease.tenant_id)
    .single();

  if (tenantErr || !tenant) {
    throw new Error(
      "buildContractContext: tenant not found — " +
        (tenantErr?.message ?? lease.tenant_id)
    );
  }

  const { data: unit, error: unitErr } = await admin
    .schema("core")
    .from("unit")
    .select("id, unit_number, property_id")
    .eq("id", lease.unit_id)
    .single();

  if (unitErr || !unit) {
    throw new Error(
      "buildContractContext: unit not found — " +
        (unitErr?.message ?? lease.unit_id)
    );
  }

  const { data: property } = await admin
    .schema("core")
    .from("property")
    .select("id, name, address")
    .eq("id", unit.property_id)
    .single();

  const { data: inspection } = await admin
    .schema("prep")
    .from("unit_inspection")
    .select("*")
    .eq("lease_id", input.leaseId)
    .maybeSingle();

  const today = new Date();
  const rentalEnd = new Date(lease.end_date);
  const day20 = addDays(rentalEnd, -20);

  const dueDay =
    lease.due_day ??
    (lease.due_date ? new Date(lease.due_date).getDate() : null);
  const dueDateStr = dueDay ? \`\${ordinal(dueDay)} of every month\` : "";

  const totalDue =
    (Number(lease.advance_amount) || 0) +
    (Number(lease.deposit_1) || 0) +
    (Number(lease.deposit_2) || 0) +
    (Number(lease.utility_deposit) || 0);

  const controlNumber =
    lease.control_number ??
    \`DRAFT-\${lease.id.slice(0, 8).toUpperCase()}\`;
  const barcodeValue =
    lease.barcode_value ?? controlNumber.replace(/\\s+/g, "").toUpperCase();

  const ctx: ContractContext = {
    legal_name: s(tenant.full_name),
    first_name: s(tenant.first_name),
    middle_name: s(tenant.middle_name),
    last_name: s(tenant.last_name),
    age: s(tenant.age),
    gender: s(tenant.gender),
    nationality: s(tenant.nationality),
    religion: s(tenant.religion),
    civil_status: s(tenant.civil_status),
    perm_address: s(tenant.permanent_address),
    rec_address: s(tenant.recent_address),
    mobile_num: s(tenant.phone),
    email_addr: s(tenant.email),
    company: s(tenant.company),
    status: s(tenant.work_status),
    position: s(tenant.work_position),
    comp_addr: s(tenant.company_address),
    comp_tel: s(tenant.company_tel),
    comp_email: s(tenant.company_email),
    comp_msgr: s(tenant.company_messenger),
    marketing_src: s(tenant.marketing_source),
    ec1_name: s(tenant.ec1_name),
    ec1_tel: s(tenant.ec1_phone),
    ec1_email: s(tenant.ec1_email),
    ec1_mssgr: s(tenant.ec1_messenger),
    ec2_name: s(tenant.ec2_name),
    ec2_tel: s(tenant.ec2_phone),
    ec2_email: s(tenant.ec2_email),
    ec2_mssgr: s(tenant.ec2_messenger),

    rate: formatPhp(lease.monthly_rent),
    occupancy_fee: formatPhp(lease.occupancy_fee),
    utility_dep: formatPhp(lease.utility_deposit),
    sec_dep: formatPhp(lease.deposit_amount),
    advance_amount: formatPhp(lease.advance_amount),
    advance_due_date: formatDate(lease.advance_due_date),
    deposit_1: formatPhp(lease.deposit_1),
    deposit_2: formatPhp(lease.deposit_2),
    deposit_1_due_date: formatDate(lease.deposit_1_due_date),
    deposit_2_due_date: formatDate(lease.deposit_2_due_date),
    due_date: dueDateStr,
    due_day: lease.due_day ?? null,
    rental_start: formatDate(lease.start_date),
    rental_end: formatDate(lease.end_date),
    move_in_date: formatDate(lease.move_in_date),
    control_number: controlNumber,
    barcode: barcodeValue,
    term_months: lease.term_months != null ? String(lease.term_months) : "6",

    unit_no: s(unit.unit_number),
    unit_num: s(unit.unit_number),
    property_name: s(property?.name),
    property_address: s(property?.address),

    reservation_fee: formatPhp(lease.reservation_fee),
    reserv_nonrefundable_on: formatDate(lease.reservation_fee_nonrefundable_on),
    deposit_nonrefund_on: formatDate(lease.deposit_nonrefundable_on),
    target_move_in: formatDate(lease.target_move_in_date),
    total: formatPhp(totalDue),

    switches: s(inspection?.switches),
    switches_com: s(inspection?.switches_comment),
    sockets: s(inspection?.sockets),
    sockets_com: s(inspection?.sockets_comment),
    cabinet: s(inspection?.cabinet),
    cabinet_com: s(inspection?.cabinet_comment),
    lavatory: s(inspection?.lavatory),
    lavatory_com: s(inspection?.lavatory_comment),
    light_bulb: s(inspection?.light_bulb),
    light_bulb_com: s(inspection?.light_bulb_comment),
    faucets: s(inspection?.faucets),
    faucets_com: s(inspection?.faucets_comment),
    shower_head: s(inspection?.shower_head),
    shower_head_com: s(inspection?.shower_head_comment),
    declogging: s(inspection?.declogging),
    declogging_com: s(inspection?.declogging_comment),
    toilet_bowl: s(inspection?.toilet_bowl),
    toilet_bowl_com: s(inspection?.toilet_bowl_comment),
    kitchen_sink: s(inspection?.kitchen_sink),
    kitchen_sink_com: s(inspection?.kitchen_sink_comment),
    wall_paint: s(inspection?.wall_paint),
    wall_paint_com: s(inspection?.wall_paint_comment),
    optional: s(inspection?.optional_items),
    optional_com: s(inspection?.optional_items_comment),
    doors: s(inspection?.door),
    doors_com: s(inspection?.door_comment),
    num_per: s(inspection?.number_of_persons),
    water: s(inspection?.water_initial),
    electric: s(inspection?.electric_initial),
    water_initial: s(inspection?.water_initial),
    electric_initial: s(inspection?.electric_initial),

    current_date: formatDate(today),
    date: formatDate(today),
    day20: formatDate(day20),
    rep: s(input.repName),
  };

  return ctx;
}

export function isPlaceholderKey(k: string): k is PlaceholderKey {
  return k.length > 0 && /^[a-z0-9_]+$/.test(k);
}
`,
  MARKER.build
);

// ===========================================================================
// 4. src/lib/contracts/render.ts — full file (legacy + strict)
// ===========================================================================
writeOrSkip(
  "src/lib/contracts/render.ts",
  `${MARKER.renderFile}
import "server-only";

// ===========================================================================
// LEGACY RENDERER (unchanged — used by simple templates)
// ===========================================================================

type RenderData = Record<string, string>;

export function renderTemplate(template: string, data: RenderData): string {
  return template.replace(/\\{\\{\\s*([\\w.]+)\\s*\\}\\}/g, (_, key) => data[key] ?? "");
}

export function buildLeaseData(input: {
  property_name: string;
  property_address: string | null;
  unit_number: string;
  tenant_full_name: string;
  tenant_email: string | null;
  tenant_phone: string | null;
  lease_start: string;
  lease_end: string;
  monthly_rent: number;
  deposit_amount: number;
  notice_period_days: number;
  deposit_1?: number;
  deposit_2?: number;
}): RenderData {
  const php = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  });
  return {
    property_name: input.property_name,
    property_address: input.property_address ?? "",
    unit_number: input.unit_number,
    tenant_full_name: input.tenant_full_name,
    tenant_email: input.tenant_email ?? "",
    tenant_phone: input.tenant_phone ?? "",
    lease_start: input.lease_start,
    lease_end: input.lease_end,
    monthly_rent: php.format(input.monthly_rent),
    deposit_amount: php.format(input.deposit_amount),
    deposit_total: php.format(
      (input.deposit_1 ?? 0) + (input.deposit_2 ?? 0)
    ),
    notice_period_days: String(input.notice_period_days),
    today: new Date().toLocaleDateString("en-PH", {
      year: "numeric", month: "long", day: "numeric",
    }),
  };
}

// ===========================================================================
// STRICT RENDERER (new — used by the long-term contract template)
// ===========================================================================
${MARKER.renderStrict}
import type { ContractContext, PlaceholderKey } from "./types";

const CONTRACT_PLACEHOLDER_RE = /\\{\\{\\s*([a-z0-9_]+)\\s*\\}\\}/g;

function escapeHtml(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type RenderContractOptions = { escape?: boolean };

export function renderContractContext(
  template: string,
  ctx: ContractContext,
  opts: RenderContractOptions = {}
): string {
  const escape = opts.escape ?? true;
  const missing = new Set<string>();
  const bag = ctx as unknown as Record<string, unknown>;

  const out = template.replace(
    CONTRACT_PLACEHOLDER_RE,
    (match, key: string) => {
      if (!(key in bag)) {
        missing.add(key);
        return match;
      }
      const raw = bag[key];
      const str = raw == null ? "" : String(raw);
      return escape ? escapeHtml(str) : str;
    }
  );

  if (missing.size > 0) {
    throw new Error(
      "renderContractContext: unresolved placeholder(s): " +
        Array.from(missing).sort().join(", ")
    );
  }
  return out;
}

export function extractPlaceholders(template: string): PlaceholderKey[] {
  const found = new Set<string>();
  for (const m of template.matchAll(CONTRACT_PLACEHOLDER_RE)) found.add(m[1]);
  return Array.from(found) as PlaceholderKey[];
}
`,
  MARKER.renderFile
);

// ===========================================================================
// 5. Patch src/lib/db/intake.ts — new lease fields + render call
// ===========================================================================

// 5a. Extend the leasePayload with billing columns
replaceOnce(
  "src/lib/db/intake.ts",
  `  const leasePayload = {
    tenant_id: tenantId,
    unit_id: (unit as { id: string }).id,
    start_date: input.rental_start,
    end_date: input.rental_end,
    move_in_date: input.rental_start,
    monthly_rent: input.rate,
    deposit_amount: input.sec_dep ?? 0,
    deposit_1: input.sec_dep ?? 0,
    deposit_2: 0,
    ad_ons: parsedAdOns,
    ad_ons_amount: computedAdOnsAmount,
    notice_period_days: 30,
    status: "active" as const,
    term: "6_months" as const,
  };`,
  `  // @@CONTRACT_ENGINE:intake-hook — extended lease payload
  const leasePayload = {
    tenant_id: tenantId,
    unit_id: (unit as { id: string }).id,
    start_date: input.rental_start,
    end_date: input.rental_end,
    move_in_date: input.rental_start,
    monthly_rent: input.rate,
    occupancy_fee: input.occupancy_fee ?? 0,
    utility_deposit: input.utility_dep ?? 0,
    advance_amount: input.advance ?? input.rate,
    advance_due_date: input.rental_start,
    // Deposit is 2 months total: split evenly into deposit_1 + deposit_2
    deposit_amount: (input.sec_dep ?? 0) * 2,
    deposit_1: input.sec_dep ?? 0,
    deposit_2: input.sec_dep ?? 0,
    deposit_1_due_date: input.rental_start,
    deposit_2_due_date: input.rental_start,
    due_day: input.due_date ? new Date(input.due_date).getDate() : null,
    ad_ons: parsedAdOns,
    ad_ons_amount: computedAdOnsAmount,
    notice_period_days: 30,
    status: "active" as const,
    term: "6_months" as const,
    term_months: 6,
  };`,
  MARKER.intakeHook + "-payload"
);

// 5b. Extend inspectionPayload with initial meter readings
replaceOnce(
  "src/lib/db/intake.ts",
  `    door: toNull(input.door), door_comment: toNull(input.door_com),
    number_of_persons: input.num_per ?? null,
    filled_by_tenant_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };`,
  `    door: toNull(input.door), door_comment: toNull(input.door_com),
    number_of_persons: input.num_per ?? null,
    water_initial: input.water ? Number(input.water) : null,
    electric_initial: input.electric ? Number(input.electric) : null,
    filled_by_tenant_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };`,
  MARKER.intakeHook + "-inspection"
);

// 5c. Insert render call right after the contract insert
insertBefore(
  "src/lib/db/intake.ts",
  `  // ---- 8. Inspection ----`,
  `  // ---- 7b. Render contract body from template ----
  // @@CONTRACT_ENGINE:intake-hook — render call
  {
    const { buildContractContext } = await import(
      "@/lib/contracts/build-context"
    );
    const { renderContractContext } = await import(
      "@/lib/contracts/render"
    );

    const { data: tmpl } = await admin
      .schema("prep")
      .from("contract_template")
      .select("id, body_markdown")
      .eq("active", true)
      .eq("term_type", "long_term")
      .or(
        \`property_id.eq.\${(property as { id: string }).id},property_id.is.null\`
      )
      .order("property_id", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (tmpl) {
      try {
        const ctx = await buildContractContext({ leaseId, repName: null });
        const rendered = renderContractContext(tmpl.body_markdown, ctx);
        await admin
          .schema("prep")
          .from("contract")
          .update({
            template_id: tmpl.id,
            generated_body: rendered,
          })
          .eq("id", contractId);
      } catch (renderErr) {
        console.error(
          "Contract render failed (non-fatal):",
          renderErr instanceof Error ? renderErr.message : renderErr
        );
      }
    }
  }

`,
  MARKER.intakeHook + "-render"
);

// ===========================================================================
// 6. Patch src/lib/db/contracts.ts — helpers
// ===========================================================================
appendOrSkip(
  "src/lib/db/contracts.ts",
  `${MARKER.contractHelp}
import { buildContractContext } from "@/lib/contracts/build-context";
import { renderContractContext } from "@/lib/contracts/render";

export async function regenerateContractBody(
  contractId: string
): Promise<void> {
  const supabase = await createClient();

  const { data: contract, error } = await supabase
    .from("contract")
    .select("id, lease_id, template_id")
    .eq("id", contractId)
    .single();

  if (error || !contract) {
    throw new Error(
      "regenerateContractBody: contract not found — " + contractId
    );
  }
  if (!contract.template_id) {
    throw new Error(
      "regenerateContractBody: contract has no template_id; cannot render."
    );
  }

  const { data: tmpl } = await supabase
    .from("contract_template")
    .select("body_markdown")
    .eq("id", contract.template_id)
    .single();

  if (!tmpl) {
    throw new Error("regenerateContractBody: template not found.");
  }

  const ctx = await buildContractContext({ leaseId: contract.lease_id });
  const rendered = renderContractContext(tmpl.body_markdown, ctx);

  const { error: upErr } = await supabase
    .from("contract")
    .update({ generated_body: rendered })
    .eq("id", contractId);
  if (upErr) throw new Error(upErr.message);
}

export async function previewContractBody(
  leaseId: string,
  templateId: string
): Promise<string> {
  const supabase = await createClient();

  const { data: tmpl } = await supabase
    .from("contract_template")
    .select("body_markdown")
    .eq("id", templateId)
    .single();

  if (!tmpl) throw new Error("previewContractBody: template not found.");

  const ctx = await buildContractContext({ leaseId });
  return renderContractContext(tmpl.body_markdown, ctx);
}
`,
  MARKER.contractHelp
);

console.log("");
console.log("Done. Next steps:");
console.log("  1. Regenerate DB types (unit_inspection.water_initial, electric_initial):");
console.log("     npx supabase gen types typescript --linked --schema public,core,acct,mkt,maint,prep,util | Set-Content -Encoding ascii src/types/db.ts");
console.log("  2. Run typecheck:");
console.log("     npm run typecheck");
console.log("  3. If green, seed the Adi 168 template (see follow-up migration).");
console.log("");
console.log("Backups (if any were made) are in scripts/.backups/");