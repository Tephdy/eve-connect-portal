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

const INVOICE_TYPE_MAP: Record<string, string> = {
  "rent": "rent",
  "deposit": "deposit",
  "penalty": "penalty",
  "add-ons": "add-ons",
  "addons": "add-ons",
  "add ons": "add-ons",
  "electric": "electricity",
  "electricity": "electricity",
  "water": "water",
  "gas": "gas",
  "utility": "utility",
  "other": "other",
};

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

// DD/MM/YYYY — used only for invoices (sheet format is DD/MM/YYYY).
function parseDateDDMMYYYY(v: string | null): string | null {
  if (!v) return null;
  const t = v.trim();
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [, dd, mm, yyyy] = m;
    const d = Number(dd);
    const mo = Number(mm);
    if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) {
      return yyyy + "-" + mm.padStart(2, "0") + "-" + dd.padStart(2, "0");
    }
    return null;
  }
  return parseDate(v);
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
  const s = v.toLowerCase().replace(/\s+/g, "_");
  const allowed = ["1_month","3_months","6_months","1_year","2_years","3_years","other"];
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

  const { data: properties } = await admin.schema("core").from("property").select("id, name, address");
  const { data: units } = await admin.schema("core").from("unit").select("id, property_id, unit_number");
  const { data: tenants } = await admin.schema("core").from("tenant").select("id, email, full_name");

  const propByName = new Map<string, string>(
    (properties ?? []).map((p: any) => [String(p.name).toLowerCase(), String(p.id)])
  );
  const unitByKey = new Map<string, string>(
    (units ?? []).map((u: any) => [u.property_id + "|" + u.unit_number, String(u.id)])
  );
  const tenantByEmail = new Map<string, string>(
    (tenants ?? [])
      .filter((t: any) => t.email)
      .map((t: any) => [String(t.email).toLowerCase(), String(t.id)])
  );
  const tenantByName = new Map<string, string>(
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
            const { error } = await admin.schema("core").from("property").update(payload).eq("id", existingId);
            if (error) throw error;
            updated++;
            continue;
          }
        }
        const { error } = await admin.schema("core").from("property").insert(payload);
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
            const { error } = await admin.schema("core").from("unit").update(payload).eq("id", existingId);
            if (error) throw error;
            updated++;
            continue;
          }
        }
        const { error } = await admin.schema("core").from("unit").insert(payload);
        if (error) throw error;
        created++;
      }

      else if (input.target === "tenants") {
        const email = clean(row.mapped.email).toLowerCase();
        const statusRaw = clean(row.mapped.status).toLowerCase();
        const ALLOWED_STATUS = ["prospect", "active", "former", "blacklisted"];
        const status = ALLOWED_STATUS.includes(statusRaw) ? statusRaw : "active";
        const payload = {
          full_name: clean(row.mapped.full_name),
          email: email || null,
          phone: clean(row.mapped.phone) || null,
          messenger_name: clean(row.mapped.messenger_name) || null,
          government_id: clean(row.mapped.government_id) || null,
          status,
        };
        let tenantId: string | null = null;
        if (row.willSkip && input.updateDuplicates && email) {
          const existingId = tenantByEmail.get(email);
          if (existingId) {
            const { error } = await admin.schema("core").from("tenant").update(payload).eq("id", existingId);
            if (error) throw error;
            tenantId = existingId;
            updated++;
          }
        } else {
          const { data: inserted, error } = await admin
            .schema("core").from("tenant").insert(payload).select("id").single();
          if (error) throw error;
          tenantId = inserted.id;
          created++;
        }

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
              const { error: leaseErr } = await admin.schema("core").from("lease").insert({
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

        let tenantId: string | undefined;
        if (email) tenantId = tenantByEmail.get(email);
        if (!tenantId && fullName) {
          const resolvedTenant = tenantByName.get(fullName.toLowerCase());
          if (typeof resolvedTenant === "string") tenantId = resolvedTenant;
        }
        if (!tenantId) {
          throw new Error("Tenant not found: " + (email || fullName));
        }

        const payload: Record<string, unknown> = {
          unit_id: unitId,
          tenant_id: tenantId,
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

        if (!payload.start_date || !payload.end_date) {
          throw new Error("Start date and end date are required");
        }

        const { error } = await admin.schema("core").from("lease").insert(payload);
        if (error) throw error;
        created++;
      }

      else if (input.target === "invoices") {
        const propName = clean(row.mapped.property_name);
        const unitNo = clean(row.mapped.unit_number);
        const fullName = clean(row.mapped.full_name);

        const propId = propByName.get(propName.toLowerCase());
        if (!propId) throw new Error("Property not found: " + propName);

        const unitId = unitByKey.get(propId + "|" + unitNo);
        if (!unitId) throw new Error("Unit " + unitNo + " not found in " + propName);

        const tenantId = tenantByName.get(fullName.toLowerCase());
        if (!tenantId) throw new Error("Tenant not found: " + fullName);

        // Find the lease on this unit for this tenant (most recent)
        const { data: lease } = await admin
          .schema("core")
          .from("lease")
          .select("id")
          .eq("unit_id", unitId)
          .eq("tenant_id", tenantId)
          .order("start_date", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!lease) {
          throw new Error(
            "No lease found for " + fullName + " in unit " + unitNo
          );
        }

        const rawType = clean(row.mapped.type).toLowerCase();
        const invoiceType = INVOICE_TYPE_MAP[rawType] ?? "other";

        const amount = parseNum(row.mapped.amount);
        if (amount === null) throw new Error("Invalid amount");

        const dueDate = parseDateDDMMYYYY(row.mapped.due_date);
        if (!dueDate) throw new Error("Invalid due date (expected DD/MM/YYYY)");

        // Duplicate check: same lease + due_date + type already exists?
        const { data: existing } = await admin
          .schema("acct")
          .from("invoice")
          .select("id")
          .eq("lease_id", (lease as { id: string }).id)
          .eq("due_date", dueDate)
          .eq("type", invoiceType)
          .maybeSingle();

        if (existing) {
          skipped++;
          continue;
        }

        const { error } = await admin
          .schema("acct")
          .from("invoice")
          .insert({
            lease_id: (lease as { id: string }).id,
            tenant_id: tenantId,
            type: invoiceType,
            amount,
            due_date: dueDate,
            status: "unpaid",
          });

        if (error) throw error;
        created++;
      }

      else if (input.target === "contracts") {
        const propName = clean(row.mapped.property_name);
        const unitNo = clean(row.mapped.unit_number);
        const fullName = clean(row.mapped.full_name);
        const fileUrl = clean(row.mapped.contract_file);

        const propId = propByName.get(propName.toLowerCase());
        if (!propId) throw new Error("Property not found: " + propName);

        const unitId = unitByKey.get(propId + "|" + unitNo);
        if (!unitId) throw new Error("Unit " + unitNo + " not found in " + propName);

        const tenantId = tenantByName.get(fullName.toLowerCase());
        if (!tenantId) throw new Error("Tenant not found: " + fullName);

        // Find the lease on this unit for this tenant
        const { data: lease } = await admin
          .schema("core")
          .from("lease")
          .select("id")
          .eq("unit_id", unitId)
          .eq("tenant_id", tenantId)
          .order("start_date", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!lease) {
          throw new Error(
            "No lease found for " + fullName + " in unit " + unitNo
          );
        }

        const leaseId = (lease as { id: string }).id;

        // Duplicate check: contract already exists for this lease?
        const { data: existing } = await admin
          .schema("prep")
          .from("contract")
          .select("id")
          .eq("lease_id", leaseId)
          .limit(1)
          .maybeSingle();

        if (existing) {
          skipped++;
          continue;
        }

        if (!fileUrl) {
          throw new Error("Contract file URL is required");
        }
        if (!/^https?:\/\//i.test(fileUrl)) {
          throw new Error("Contract file must be a URL starting with http:// or https://");
        }

        const { error } = await admin
          .schema("prep")
          .from("contract")
          .insert({
            lease_id: leaseId,
            template_id: null,
            generated_body: null,
            status: "signed",
            signed_at: new Date().toISOString(),
            signed_document_url: fileUrl,
          });

        if (error) throw error;
        created++;
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : String(err);
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