import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTarget } from "./field-defs";
import type {
  ColumnMapping,
  ImportPreviewRow,
  ImportSummary,
  RowError,
  TargetTable,
} from "./types";

// ---- value parsers ----

function clean(v: string | null | undefined): string {
  return (v ?? "").trim();
}

function parseNum(v: string | null): number | null {
  if (!v) return null;
  const n = Number(v.replace(/[₱,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseDate(v: string | null): string | null {
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

// ---- main commit ----

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

  // Preload lookup tables
  const { data: properties } = await admin.from("property").select("id, name");
  const { data: units } = await admin.from("unit").select("id, property_id, unit_number");
  const { data: tenants } = await admin.from("tenant").select("id, email");

  const propByName = new Map(
    (properties ?? []).map((p: any) => [p.name.toLowerCase(), p.id])
  );
  const unitByKey = new Map(
    (units ?? []).map((u: any) => [u.property_id + "|" + u.unit_number, u.id])
  );
  const tenantByEmail = new Map(
    (tenants ?? []).map((t: any) => [t.email?.toLowerCase(), t.id])
  );

  // Process row by row
  for (const row of input.preview) {
    // Skip rows with validation errors
    if (row.errors.length > 0) {
      errors.push(...row.errors);
      failed++;
      continue;
    }

    // Handle duplicates
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
            .from("tenant")
            .insert(payload)
            .select("id")
            .single();
          if (error) throw error;
          tenantId = inserted.id;
          created++;
        }

        // Optional lease creation
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
        const email = clean(row.mapped.tenant_email).toLowerCase();
        const tenantId = tenantByEmail.get(email);
        if (!tenantId) throw new Error("Tenant not found: " + email);

        const propName = clean(row.mapped.property_name);
        const unitNo = clean(row.mapped.unit_number);
        const propId = propByName.get(propName.toLowerCase());
        if (!propId) throw new Error("Property not found: " + propName);

        const unitId = unitByKey.get(propId + "|" + unitNo);
        if (!unitId) throw new Error("Unit not found: " + unitNo + " in " + propName);

        const { error } = await admin.from("lease").insert({
          unit_id: unitId,
          tenant_id: tenantId,
          start_date: parseDate(row.mapped.start_date),
          end_date: parseDate(row.mapped.end_date),
          monthly_rent: parseNum(row.mapped.monthly_rent) ?? 0,
          deposit_amount: parseNum(row.mapped.deposit_amount) ?? 0,
          due_date: parseDate(row.mapped.due_date),
          notice_period_days: parseNum(row.mapped.notice_period_days) ?? 30,
          status: "active",
        });
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
