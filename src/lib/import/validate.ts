import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTarget } from "./field-defs";
import type {
  ColumnMapping,
  ImportPreviewRow,
  RowError,
  TargetTable,
} from "./types";

// Normalize phone / numbers to clean strings
function clean(v: string | null | undefined): string {
  return (v ?? "").trim();
}

function parseNum(v: string): number | null {
  if (!v) return null;
  const n = Number(v.replace(/[₱,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseDate(v: string): string | null {
  if (!v) return null;
  // Try ISO first
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  // Try MM/DD/YYYY
  const m1 = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m1) {
    const [, mm, dd, yyyy] = m1;
    return yyyy + "-" + mm.padStart(2, "0") + "-" + dd.padStart(2, "0");
  }
  // Try YYYY/MM/DD
  const m2 = v.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (m2) {
    const [, yyyy, mm, dd] = m2;
    return yyyy + "-" + mm.padStart(2, "0") + "-" + dd.padStart(2, "0");
  }
  // Fallback
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

  // Preload existing data for duplicate checks
  const [{ data: properties }, { data: units }, { data: tenants }] =
    await Promise.all([
      admin.from("property").select("id, name"),
      admin.from("unit").select("id, property_id, unit_number"),
      admin.from("tenant").select("id, email"),
    ]);

  const propByName = new Map(
    (properties ?? []).map((p: any) => [p.name.toLowerCase(), p.id])
  );
  const unitByKey = new Map(
    (units ?? []).map((u: any) => [u.property_id + "|" + u.unit_number, u.id])
  );
  const tenantByEmail = new Map(
    (tenants ?? []).map((t: any) => [t.email?.toLowerCase(), t.id])
  );

  const results: ImportPreviewRow[] = [];

  input.rows.forEach((source, index) => {
    const errors: RowError[] = [];
    const warnings: string[] = [];
    const mapped: Record<string, string | null> = {};

    // Apply mapping
    for (const field of def.fields) {
      const header = input.mapping[field.key];
      mapped[field.key] = header ? clean(source[header]) : null;
    }

    // Required fields
    for (const field of def.fields) {
      if (field.required && !mapped[field.key]) {
        errors.push({
          rowIndex: index,
          field: field.key,
          message: field.label + " is required",
        });
      }
    }

    // Type-specific validation + duplicate detection
    let willSkip = false;
    let skipReason: string | undefined;

    if (input.target === "properties") {
      const name = mapped.name;
      if (name && propByName.has(name.toLowerCase())) {
        willSkip = true;
        skipReason = "Property \"" + name + "\" already exists";
      }
    }

    if (input.target === "units") {
      const propName = mapped.property_name;
      const unitNo = mapped.unit_number;
      if (propName && unitNo) {
        const propId = propByName.get(propName.toLowerCase());
        if (!propId) {
          errors.push({
            rowIndex: index,
            field: "property_name",
            message: "Property \"" + propName + "\" not found",
          });
        } else if (unitByKey.has(propId + "|" + unitNo)) {
          willSkip = true;
          skipReason = "Unit " + unitNo + " already exists in " + propName;
        }
      }
    }

    if (input.target === "tenants") {
      const email = mapped.email;
      if (email && tenantByEmail.has(email.toLowerCase())) {
        willSkip = true;
        skipReason = "Tenant with email " + email + " already exists";
      }
    }

    if (input.target === "leases") {
      const email = mapped.tenant_email;
      const propName = mapped.property_name;
      const unitNo = mapped.unit_number;
      if (email && !tenantByEmail.has(email.toLowerCase())) {
        errors.push({
          rowIndex: index,
          field: "tenant_email",
          message: "No tenant found with email " + email,
        });
      }
      if (propName && unitNo) {
        const propId = propByName.get(propName.toLowerCase());
        if (!propId) {
          errors.push({
            rowIndex: index,
            field: "property_name",
            message: "Property \"" + propName + "\" not found",
          });
        } else if (!unitByKey.has(propId + "|" + unitNo)) {
          errors.push({
            rowIndex: index,
            field: "unit_number",
            message: "Unit " + unitNo + " not found in " + propName,
          });
        }
      }
    }

    // Number / date parsing warnings
    for (const field of def.fields) {
      if (field.type === "number" && mapped[field.key]) {
        if (parseNum(mapped[field.key]!) === null) {
          errors.push({
            rowIndex: index,
            field: field.key,
            message: field.label + " is not a valid number: \"" + mapped[field.key] + "\"",
          });
        }
      }
      if (field.type === "date" && mapped[field.key]) {
        if (parseDate(mapped[field.key]!) === null) {
          errors.push({
            rowIndex: index,
            field: field.key,
            message: field.label + " is not a valid date: \"" + mapped[field.key] + "\"",
          });
        }
      }
      if (field.type === "enum" && mapped[field.key] && field.enumValues) {
        const v = mapped[field.key]!.toLowerCase();
        if (!field.enumValues.includes(v)) {
          warnings.push(
            field.label + ": \"" + mapped[field.key] + "\" not in list — will use default"
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
