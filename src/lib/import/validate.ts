import "server-only";
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
  const n = Number(v.replace(/[₱,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseDate(v: string): string | null {
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  const m1 = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m1) {
    const [, mm, dd, yyyy] = m1;
    return yyyy + "-" + mm.padStart(2, "0") + "-" + dd.padStart(2, "0");
  }
  const m2 = v.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
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
