#!/usr/bin/env node
/**
 * Importer — updated Leases target
 * Usage: node scaffold-import-leases.mjs
 *
 * Updates:
 *   src/lib/import/field-defs.ts    (Leases target with new fields + aliases)
 *   src/lib/import/auto-map.ts      (nothing — uses field-defs)
 *   src/lib/import/validate.ts      (match by name OR email for tenants)
 *   src/lib/import/commit.ts        (match by name OR email; write new lease fields)
 */

import { mkdir, writeFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import { join, dirname } from "node:path";

const ROOT = process.cwd();
const FILES = {};

async function exists(p) {
  try { await access(p, constants.F_OK); return true; } catch { return false; }
}

// =============================================================================
// 1. Field definitions — updated Leases target
// =============================================================================
FILES["src/lib/import/field-defs.ts"] =
`import type { TargetTable } from "./types";

export type FieldDef = {
  key: string;
  label: string;
  required: boolean;
  type: "text" | "number" | "date" | "enum";
  enumValues?: string[];
  aliases: string[];
  hint?: string;
};

export const TARGETS: {
  key: TargetTable;
  label: string;
  description: string;
  permission: string;
  fields: FieldDef[];
}[] = [
  {
    key: "properties",
    label: "Properties",
    description: "One row per property.",
    permission: "property:create",
    fields: [
      { key: "name", label: "Name", required: true, type: "text", aliases: ["property", "property name", "name"] },
      { key: "address", label: "Address", required: false, type: "text", aliases: ["address", "location", "full address"] },
      { key: "type", label: "Type", required: false, type: "enum", enumValues: ["residential", "commercial", "mixed"], aliases: ["type", "category"] },
      { key: "total_units", label: "Total units", required: false, type: "number", aliases: ["total units", "units", "unit count"] },
    ],
  },
  {
    key: "units",
    label: "Units",
    description: "One row per unit. Property must exist.",
    permission: "unit:create",
    fields: [
      { key: "property_name", label: "Property name", required: true, type: "text", aliases: ["property", "property name", "building"] },
      { key: "unit_number", label: "Unit number", required: true, type: "text", aliases: ["unit", "unit no", "unit number", "unit #", "door"] },
      { key: "floor", label: "Floor", required: false, type: "number", aliases: ["floor", "level"] },
      { key: "bedrooms", label: "Bedrooms", required: false, type: "number", aliases: ["bedrooms", "br", "bed"] },
      { key: "bathrooms", label: "Bathrooms", required: false, type: "number", aliases: ["bathrooms", "bath", "cr", "t&b"] },
      { key: "area_sqm", label: "Area (sqm)", required: false, type: "number", aliases: ["area", "sqm", "size", "area sqm", "square meters"] },
      { key: "base_rent", label: "Base rent", required: false, type: "number", aliases: ["rent", "base rent", "monthly rent", "price"] },
      { key: "status", label: "Status", required: false, type: "enum", enumValues: ["vacant", "occupied", "reserved", "maintenance", "unavailable"], aliases: ["status", "state"] },
    ],
  },
  {
    key: "tenants",
    label: "Tenants",
    description: "One row per tenant. Optionally creates a lease if unit + dates are present.",
    permission: "tenant:create",
    fields: [
      { key: "full_name", label: "Full name", required: true, type: "text", aliases: ["tenant name", "tenant", "full name", "name"] },
      { key: "email", label: "Email", required: false, type: "text", aliases: ["email", "e-mail", "email address"] },
      { key: "phone", label: "Phone", required: false, type: "text", aliases: ["phone", "mobile", "contact", "cell"] },
      { key: "messenger_name", label: "Messenger name", required: false, type: "text", aliases: ["messenger", "messenger name", "fb", "facebook"] },
      { key: "government_id", label: "Government ID", required: false, type: "text", aliases: ["id", "gov id", "government id"] },
      { key: "property_name", label: "Property name", required: false, type: "text", aliases: ["property", "property name", "building"] },
      { key: "unit_number", label: "Unit number", required: false, type: "text", aliases: ["unit", "unit no", "unit number"] },
      { key: "monthly_rent", label: "Monthly rent", required: false, type: "number", aliases: ["rent", "monthly rent", "rate", "monthly rent (php)"] },
      { key: "move_in_date", label: "Move-in date", required: false, type: "date", aliases: ["move in", "move-in", "movein", "move in date", "start", "start date"] },
      { key: "end_date", label: "End of contract", required: false, type: "date", aliases: ["end", "end date", "end of contract", "contract end", "contract"] },
    ],
  },
  {
    key: "leases",
    label: "Leases",
    description: "One row per lease. Tenant matched by name or email; unit by property + number.",
    permission: "lease:create",
    fields: [
      // ---- Required ----
      { key: "property_name", label: "Property", required: true, type: "text", aliases: ["property", "property name", "building"] },
      { key: "unit_number", label: "Unit", required: true, type: "text", aliases: ["unit", "unit no", "unit number", "unit #"] },
      { key: "full_name", label: "Full name", required: true, type: "text", aliases: ["tenant name", "tenant", "full name", "name"] },

      // ---- Optional lease fields ----
      { key: "email", label: "Email", required: false, type: "text", aliases: ["email", "e-mail", "email address"] },
      { key: "address", label: "Address", required: false, type: "text", aliases: ["address", "location", "full address"], hint: "Stored on the lease record (uses unit's property if blank)" },
      { key: "term", label: "Contract", required: false, type: "enum", enumValues: ["1_month","3_months","6_months","1_year","2_years","3_years","other"], aliases: ["contract", "term", "contract term", "duration"], hint: "e.g. 1_month, 6_months, 1_year" },
      { key: "intent", label: "Intent", required: false, type: "enum", enumValues: ["new","renew","extend"], aliases: ["intent", "type", "purpose"] },
      { key: "start_date", label: "Start date", required: false, type: "date", aliases: ["start", "start date", "move in", "move-in"] },
      { key: "end_date", label: "End of contract", required: false, type: "date", aliases: ["end", "end date", "end of contract", "contract end"] },
      { key: "move_in_date", label: "Move-in date", required: false, type: "date", aliases: ["move in", "move-in", "move in date", "movein"] },
      { key: "due_date", label: "Rent due", required: false, type: "date", aliases: ["due", "due date", "rent due", "rent due date"] },
      { key: "monthly_rent", label: "Monthly rent (PHP)", required: false, type: "number", aliases: ["rent", "monthly rent", "rate", "monthly rent (php)"] },
      { key: "deposit_1", label: "1st deposit", required: false, type: "number", aliases: ["1st deposit", "first deposit", "deposit 1", "deposit1"] },
      { key: "deposit_2", label: "2nd deposit", required: false, type: "number", aliases: ["2nd deposit", "second deposit", "deposit 2", "deposit2"] },
      { key: "ad_ons", label: "Add-ons", required: false, type: "text", aliases: ["add-ons", "addons", "add ons", "extras", "inclusions"], hint: "Comma-separated: Foam, AC, Bedframe" },
      { key: "ad_ons_amount", label: "Add-ons amount", required: false, type: "number", aliases: ["add-ons amount", "addons amount", "add ons amount", "extras amount"] },
      { key: "notice_period_days", label: "Notice period", required: false, type: "number", aliases: ["notice period", "notice", "notice days", "notice period (days)"] },
    ],
  },
];

export function getTarget(key: TargetTable) {
  return TARGETS.find((t) => t.key === key);
}
`;

// =============================================================================
// 2. Validation — match tenant by name OR email
// =============================================================================
FILES["src/lib/import/validate.ts"] =
`import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTarget } from "./field-defs";
import type {
  ColumnMapping,
  ImportPreviewRow,
  RowError,
  TargetTable,
} from "./types";

function clean(v: string | null | undefined): string {
  return (v ?? "").trim();
}

function parseNum(v: string): number | null {
  if (!v) return null;
  const n = Number(v.replace(/[₱,\\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseDate(v: string): string | null {
  if (!v) return null;
  if (/^\\d{4}-\\d{2}-\\d{2}/.test(v)) return v.slice(0, 10);
  const m1 = v.match(/^(\\d{1,2})\\/(\\d{1,2})\\/(\\d{4})$/);
  if (m1) {
    const [, mm, dd, yyyy] = m1;
    return yyyy + "-" + mm.padStart(2, "0") + "-" + dd.padStart(2, "0");
  }
  const m2 = v.match(/^(\\d{4})\\/(\\d{1,2})\\/(\\d{1,2})$/);
  if (m2) {
    const [, yyyy, mm, dd] = m2;
    return yyyy + "-" + mm.padStart(2, "0") + "-" + dd.padStart(2, "0");
  }
  const d = new Date(v);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

export async function validateImport(input: {
  target: TargetTable;
  mapping: ColumnMapping;
  rows: Record<string, string>[];
}): Promise<ImportPreviewRow[]> {
  const def = getTarget(input.target);
  if (!def) throw new Error("Unknown target: " + input.target);

  const admin = createAdminClient();

  const [{ data: properties }, { data: units }, { data: tenants }] =
    await Promise.all([
      admin.from("property").select("id, name, address"),
      admin.from("unit").select("id, property_id, unit_number"),
      admin.from("tenant").select("id, email, full_name"),
    ]);

  const propByName = new Map(
    (properties ?? []).map((p: any) => [p.name.toLowerCase(), p.id])
  );
  const unitByKey = new Map(
    (units ?? []).map((u: any) => [u.property_id + "|" + u.unit_number, u.id])
  );
  const tenantByEmail = new Map(
    (tenants ?? [])
      .filter((t: any) => t.email)
      .map((t: any) => [String(t.email).toLowerCase(), t.id])
  );
  const tenantByName = new Map(
    (tenants ?? []).map((t: any) => [String(t.full_name).toLowerCase(), t.id])
  );

  const results: ImportPreviewRow[] = [];

  input.rows.forEach((source, index) => {
    const errors: RowError[] = [];
    const warnings: string[] = [];
    const mapped: Record<string, string | null> = {};

    for (const field of def.fields) {
      const header = input.mapping[field.key];
      mapped[field.key] = header ? clean(source[header]) : null;
    }

    // Required checks
    for (const field of def.fields) {
      if (field.required && !mapped[field.key]) {
        errors.push({
          rowIndex: index,
          field: field.key,
          message: field.label + " is required",
        });
      }
    }

    let willSkip = false;
    let skipReason: string | undefined;

    // ---- Properties ----
    if (input.target === "properties") {
      const name = mapped.name;
      if (name && propByName.has(name.toLowerCase())) {
        willSkip = true;
        skipReason = 'Property "' + name + '" already exists';
      }
    }

    // ---- Units ----
    if (input.target === "units") {
      const propName = mapped.property_name;
      const unitNo = mapped.unit_number;
      if (propName && unitNo) {
        const propId = propByName.get(propName.toLowerCase());
        if (!propId) {
          errors.push({
            rowIndex: index,
            field: "property_name",
            message: 'Property "' + propName + '" not found',
          });
        } else if (unitByKey.has(propId + "|" + unitNo)) {
          willSkip = true;
          skipReason = "Unit " + unitNo + " already exists in " + propName;
        }
      }
    }

    // ---- Tenants ----
    if (input.target === "tenants") {
      const email = mapped.email;
      if (email && tenantByEmail.has(email.toLowerCase())) {
        willSkip = true;
        skipReason = "Tenant with email " + email + " already exists";
      }
    }

    // ---- Leases (NEW logic: match by name OR email; property + unit required) ----
    if (input.target === "leases") {
      const propName = mapped.property_name;
      const unitNo = mapped.unit_number;
      const fullName = mapped.full_name;
      const email = mapped.email;

      // Property must exist
      let propId: string | undefined;
      if (propName) {
        propId = propByName.get(propName.toLowerCase());
        if (!propId) {
          errors.push({
            rowIndex: index,
            field: "property_name",
            message: 'Property "' + propName + '" not found',
          });
        }
      }

      // Unit must exist in that property
      if (propId && unitNo) {
        if (!unitByKey.has(propId + "|" + unitNo)) {
          errors.push({
            rowIndex: index,
            field: "unit_number",
            message: "Unit " + unitNo + " not found in " + propName,
          });
        }
      }

      // Tenant must exist — match by email first, then by name
      if (fullName || email) {
        const matchedByName = fullName ? tenantByName.get(fullName.toLowerCase()) : undefined;
        const matchedByEmail = email ? tenantByEmail.get(email.toLowerCase()) : undefined;

        if (!matchedByEmail && !matchedByName) {
          errors.push({
            rowIndex: index,
            field: fullName ? "full_name" : "email",
            message:
              "No tenant found matching " +
              (email ? "email " + email : "") +
              (email && fullName ? " or " : "") +
              (fullName ? 'name "' + fullName + '"' : ""),
          });
        }
      }
    }

    // Type checks
    for (const field of def.fields) {
      if (field.type === "number" && mapped[field.key]) {
        if (parseNum(mapped[field.key]!) === null) {
          errors.push({
            rowIndex: index,
            field: field.key,
            message: field.label + " is not a valid number",
          });
        }
      }
      if (field.type === "date" && mapped[field.key]) {
        if (parseDate(mapped[field.key]!) === null) {
          errors.push({
            rowIndex: index,
            field: field.key,
            message: field.label + " is not a valid date",
          });
        }
      }
      if (field.type === "enum" && mapped[field.key] && field.enumValues) {
        const v = mapped[field.key]!.toLowerCase();
        if (!field.enumValues.includes(v)) {
          warnings.push(
            field.label + ': "' + mapped[field.key] + '" not in list — using default'
          );
        }
      }
    }

    results.push({
      index,
      source,
      mapped,
      errors,
      warnings,
      willSkip,
      skipReason,
    });
  });

  return results;
}
`;

// =============================================================================
// 3. Commit — writes lease rows with all the new fields
// =============================================================================
FILES["src/lib/import/commit.ts"] =
`import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTarget } from "./field-defs";
import type {
  ColumnMapping,
  ImportPreviewRow,
  ImportSummary,
  RowError,
  TargetTable,
} from "./types";

function clean(v: string | null | undefined): string {
  return (v ?? "").trim();
}

function parseNum(v: string | null): number | null {
  if (!v) return null;
  const n = Number(v.replace(/[₱,\\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseDate(v: string | null): string | null {
  if (!v) return null;
  if (/^\\d{4}-\\d{2}-\\d{2}/.test(v)) return v.slice(0, 10);
  const m1 = v.match(/^(\\d{1,2})\\/(\\d{1,2})\\/(\\d{4})$/);
  if (m1) {
    const [, mm, dd, yyyy] = m1;
    return yyyy + "-" + mm.padStart(2, "0") + "-" + dd.padStart(2, "0");
  }
  const m2 = v.match(/^(\\d{4})\\/(\\d{1,2})\\/(\\d{1,2})$/);
  if (m2) {
    const [, yyyy, mm, dd] = m2;
    return yyyy + "-" + mm.padStart(2, "0") + "-" + dd.padStart(2, "0");
  }
  const d = new Date(v);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

function parseAdOns(raw: string | null): unknown[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((text) => ({ text }));
}

function normalizeTerm(v: string | null): string | null {
  if (!v) return null;
  const s = v.toLowerCase().replace(/\\s+/g, "_");
  const allowed = ["1_month","3_months","6_months","1_year","2_years","3_years","other"];
  // Common variations
  if (s.includes("1_month") || s === "1_month" || s === "1_month_lease") return "1_month";
  if (s.includes("6_month")) return "6_months";
  if (s.includes("3_month")) return "3_months";
  if (s.includes("1_year") || s === "1_year" || s === "1_yr" || s === "12_months") return "1_year";
  if (s.includes("2_year")) return "2_years";
  if (s.includes("3_year")) return "3_years";
  return allowed.includes(s) ? s : "other";
}

function normalizeIntent(v: string | null): string {
  if (!v) return "new";
  const s = v.toLowerCase();
  if (["renew","renewal"].includes(s)) return "renew";
  if (["extend","extension"].includes(s)) return "extend";
  return "new";
}

export async function commitImport(input: {
  target: TargetTable;
  mapping: ColumnMapping;
  rows: Record<string, string>[];
  preview: ImportPreviewRow[];
  updateDuplicates: boolean;
  actor_id: string | null;
}): Promise<ImportSummary> {
  const def = getTarget(input.target);
  if (!def) throw new Error("Unknown target: " + input.target);

  const admin = createAdminClient();
  const errors: RowError[] = [];
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  const { data: properties } = await admin.from("property").select("id, name, address");
  const { data: units } = await admin.from("unit").select("id, property_id, unit_number");
  const { data: tenants } = await admin.from("tenant").select("id, email, full_name");

  const propByName = new Map(
    (properties ?? []).map((p: any) => [p.name.toLowerCase(), p.id])
  );
  const propAddressById = new Map(
    (properties ?? []).map((p: any) => [p.id, p.address])
  );
  const unitByKey = new Map(
    (units ?? []).map((u: any) => [u.property_id + "|" + u.unit_number, u.id])
  );
  const tenantByEmail = new Map(
    (tenants ?? [])
      .filter((t: any) => t.email)
      .map((t: any) => [String(t.email).toLowerCase(), t.id])
  );
  const tenantByName = new Map(
    (tenants ?? []).map((t: any) => [String(t.full_name).toLowerCase(), t.id])
  );

  for (const row of input.preview) {
    if (row.errors.length > 0) {
      errors.push(...row.errors);
      failed++;
      continue;
    }
    if (row.willSkip && !input.updateDuplicates) {
      skipped++;
      continue;
    }

    try {
      if (input.target === "properties") {
        const name = clean(row.mapped.name);
        const payload = {
          name,
          address: clean(row.mapped.address) || null,
          type: (row.mapped.type || "residential").toLowerCase(),
          total_units: parseNum(row.mapped.total_units) ?? 0,
        };
        if (row.willSkip && input.updateDuplicates) {
          const existingId = propByName.get(name.toLowerCase());
          if (existingId) {
            const { error } = await admin.from("property").update(payload).eq("id", existingId);
            if (error) throw error;
            updated++;
            continue;
          }
        }
        const { error } = await admin.from("property").insert(payload);
        if (error) throw error;
        created++;
      }

      else if (input.target === "units") {
        const propName = clean(row.mapped.property_name);
        const unitNo = clean(row.mapped.unit_number);
        const propId = propByName.get(propName.toLowerCase());
        if (!propId) throw new Error("Property not found: " + propName);

        const payload = {
          property_id: propId,
          unit_number: unitNo,
          floor: parseNum(row.mapped.floor),
          bedrooms: parseNum(row.mapped.bedrooms),
          bathrooms: parseNum(row.mapped.bathrooms),
          area_sqm: parseNum(row.mapped.area_sqm),
          base_rent: parseNum(row.mapped.base_rent),
          status: (row.mapped.status || "vacant").toLowerCase(),
        };
        if (row.willSkip && input.updateDuplicates) {
          const existingId = unitByKey.get(propId + "|" + unitNo);
          if (existingId) {
            const { error } = await admin.from("unit").update(payload).eq("id", existingId);
            if (error) throw error;
            updated++;
            continue;
          }
        }
        const { error } = await admin.from("unit").insert(payload);
        if (error) throw error;
        created++;
      }

      else if (input.target === "tenants") {
        const email = clean(row.mapped.email).toLowerCase();
        const payload = {
          full_name: clean(row.mapped.full_name),
          email: email || null,
          phone: clean(row.mapped.phone) || null,
          messenger_name: clean(row.mapped.messenger_name) || null,
          government_id: clean(row.mapped.government_id) || null,
          status: "active",
        };
        let tenantId: string | null = null;
        if (row.willSkip && input.updateDuplicates && email) {
          const existingId = tenantByEmail.get(email);
          if (existingId) {
            const { error } = await admin.from("tenant").update(payload).eq("id", existingId);
            if (error) throw error;
            tenantId = existingId;
            updated++;
          }
        } else {
          const { data: inserted, error } = await admin
            .from("tenant").insert(payload).select("id").single();
          if (error) throw error;
          tenantId = inserted.id;
          created++;
        }

        // Optional lease creation from tenant row
        const propName = clean(row.mapped.property_name);
        const unitNo = clean(row.mapped.unit_number);
        const moveIn = parseDate(row.mapped.move_in_date);
        const endDate = parseDate(row.mapped.end_date);
        const rent = parseNum(row.mapped.monthly_rent);

        if (tenantId && propName && unitNo && moveIn && endDate && rent) {
          const propId = propByName.get(propName.toLowerCase());
          if (propId) {
            const unitId = unitByKey.get(propId + "|" + unitNo);
            if (unitId) {
              const { error: leaseErr } = await admin.from("lease").insert({
                unit_id: unitId,
                tenant_id: tenantId,
                start_date: moveIn,
                end_date: endDate,
                monthly_rent: rent,
                deposit_amount: 0,
                notice_period_days: 30,
                status: "active",
              });
              if (leaseErr) {
                errors.push({
                  rowIndex: row.index,
                  message: "Tenant created but lease failed: " + leaseErr.message,
                });
              }
            }
          }
        }
      }

      else if (input.target === "leases") {
        const propName = clean(row.mapped.property_name);
        const unitNo = clean(row.mapped.unit_number);
        const fullName = clean(row.mapped.full_name);
        const email = clean(row.mapped.email).toLowerCase();

        const propId = propByName.get(propName.toLowerCase());
        if (!propId) throw new Error("Property not found: " + propName);

        const unitId = unitByKey.get(propId + "|" + unitNo);
        if (!unitId) throw new Error("Unit " + unitNo + " not found in " + propName);

        // Tenant lookup: email first, then name
        let tenantId: string | undefined;
        if (email) tenantId = tenantByEmail.get(email);
        if (!tenantId && fullName) tenantId = tenantByName.get(fullName.toLowerCase());
        if (!tenantId) {
          throw new Error(
            "Tenant not found: " + (email || fullName)
          );
        }

        const address = clean(row.mapped.address) || propAddressById.get(propId) || null;

        const payload: Record<string, unknown> = {
          unit_id: unitId,
          tenant_id: tenantId,
          address,
          term: normalizeTerm(row.mapped.term),
          intent: normalizeIntent(row.mapped.intent),
          start_date: parseDate(row.mapped.start_date),
          end_date: parseDate(row.mapped.end_date),
          move_in_date: parseDate(row.mapped.move_in_date),
          due_date: parseDate(row.mapped.due_date),
          monthly_rent: parseNum(row.mapped.monthly_rent) ?? 0,
          deposit_1: parseNum(row.mapped.deposit_1) ?? 0,
          deposit_2: parseNum(row.mapped.deposit_2) ?? 0,
          ad_ons: parseAdOns(row.mapped.ad_ons),
          ad_ons_amount: parseNum(row.mapped.ad_ons_amount) ?? 0,
          notice_period_days: parseNum(row.mapped.notice_period_days) ?? 30,
          status: "active",
        };

        // Validate dates
        if (!payload.start_date || !payload.end_date) {
          throw new Error("Start date and end date are required");
        }

        const { error } = await admin.from("lease").insert(payload);
        if (error) throw error;
        created++;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ rowIndex: row.index, message });
      failed++;
    }
  }

  return {
    target: input.target,
    totalRows: input.preview.length,
    created,
    updated,
    skipped,
    failed,
    errors,
  };
}
`;

// -----------------------------------------------------------------------------
// Runner
// -----------------------------------------------------------------------------
async function main() {
  const pkg = join(ROOT, "package.json");
  if (!(await exists(pkg))) {
    console.error("package.json not found. Run from project root.");
    process.exit(1);
  }

  console.log("Importer — updated Leases target\\n");

  let count = 0;
  for (const [relPath, content] of Object.entries(FILES)) {
    const full = join(ROOT, relPath);
    const exists_ = await exists(full);
    console.log((exists_ ? "  ~ " : "  + ") + relPath);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, content, "utf8");
    count++;
  }

  console.log("\\nDone — " + count + " file(s) written.\\n");
  console.log("Next:");
  console.log("  npm run typecheck");
  console.log("  npm run dev");
  console.log("  Test at /property/import → pick target 'Leases'");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});