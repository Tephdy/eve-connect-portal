#!/usr/bin/env node
/**
 * CSV/XLSX/Sheets Importer — Pass 2 (Mapping + Validation)
 * Usage: node scaffold-import-pass2.mjs
 *
 * Creates:
 *   src/lib/import/field-defs.ts
 *   src/lib/import/auto-map.ts
 *   src/lib/import/validate.ts
 *   src/components/import/target-picker.tsx
 *   src/components/import/mapping-form.tsx
 *   src/components/import/validation-summary.tsx
 *
 * Updates:
 *   src/app/(dashboard)/property/import/actions.ts  (add validateImportAction)
 *   src/components/import/wizard.tsx                (wire Pass 2 step)
 */

import { mkdir, writeFile, access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { join, dirname } from "node:path";

const ROOT = process.cwd();
const FILES = {};

async function exists(p) {
  try { await access(p, constants.F_OK); return true; } catch { return false; }
}

// =============================================================================
// 1. Field definitions per target table
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
      { key: "property_name", label: "Property name", required: false, type: "text", aliases: ["property", "property name", "building"], hint: "If present with unit, creates a lease." },
      { key: "unit_number", label: "Unit number", required: false, type: "text", aliases: ["unit", "unit no", "unit number"], hint: "Used with property name to link a lease." },
      { key: "monthly_rent", label: "Monthly rent", required: false, type: "number", aliases: ["rent", "monthly rent", "rate"] },
      { key: "move_in_date", label: "Move-in date", required: false, type: "date", aliases: ["move in", "move-in", "movein", "move in date", "start", "start date"] },
      { key: "end_date", label: "End of contract", required: false, type: "date", aliases: ["end", "end date", "end of contract", "contract end"] },
    ],
  },
  {
    key: "leases",
    label: "Leases",
    description: "One row per lease. Tenant and unit must exist.",
    permission: "lease:create",
    fields: [
      { key: "tenant_email", label: "Tenant email", required: true, type: "text", aliases: ["email", "tenant email", "e-mail"] },
      { key: "property_name", label: "Property name", required: true, type: "text", aliases: ["property", "property name", "building"] },
      { key: "unit_number", label: "Unit number", required: true, type: "text", aliases: ["unit", "unit no", "unit number"] },
      { key: "start_date", label: "Start date", required: true, type: "date", aliases: ["start", "start date", "move in", "move-in"] },
      { key: "end_date", label: "End date", required: true, type: "date", aliases: ["end", "end date", "contract end"] },
      { key: "monthly_rent", label: "Monthly rent", required: false, type: "number", aliases: ["rent", "monthly rent", "rate"] },
      { key: "deposit_amount", label: "Deposit amount", required: false, type: "number", aliases: ["deposit", "deposit amount"] },
      { key: "due_date", label: "Due date", required: false, type: "date", aliases: ["due", "due date"] },
      { key: "notice_period_days", label: "Notice period (days)", required: false, type: "number", aliases: ["notice", "notice days", "notice period"] },
    ],
  },
];

export function getTarget(key: TargetTable) {
  return TARGETS.find((t) => t.key === key);
}
`;

// =============================================================================
// 2. Auto-mapping by fuzzy header match
// =============================================================================
FILES["src/lib/import/auto-map.ts"] =
`import type { ColumnMapping, TargetTable } from "./types";
import { getTarget } from "./field-defs";

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\\s+/g, " ")
    .trim();
}

/**
 * For each field in the target, find the source header that best matches.
 * Uses alias matching + fuzzy equality.
 */
export function autoMapColumns(
  target: TargetTable,
  headers: string[]
): ColumnMapping {
  const def = getTarget(target);
  if (!def) return {};

  const normalized = headers.map((h) => ({ raw: h, norm: normalize(h) }));
  const used = new Set<string>();
  const mapping: ColumnMapping = {};

  // Pass 1: exact alias matches
  for (const field of def.fields) {
    const aliases = [field.key, field.label, ...field.aliases].map(normalize);
    const exact = normalized.find(
      (h) => !used.has(h.raw) && aliases.includes(h.norm)
    );
    if (exact) {
      mapping[field.key] = exact.raw;
      used.add(exact.raw);
    }
  }

  // Pass 2: partial alias matches (contains)
  for (const field of def.fields) {
    if (mapping[field.key]) continue;
    const aliases = [field.key, field.label, ...field.aliases].map(normalize);
    const partial = normalized.find((h) => {
      if (used.has(h.raw)) return false;
      return aliases.some((a) => a.length > 2 && (h.norm.includes(a) || a.includes(h.norm)));
    });
    if (partial) {
      mapping[field.key] = partial.raw;
      used.add(partial.raw);
    }
  }

  // Remaining fields → null
  for (const field of def.fields) {
    if (!(field.key in mapping)) mapping[field.key] = null;
  }

  return mapping;
}

export function countMapped(mapping: ColumnMapping): number {
  return Object.values(mapping).filter((v) => v != null).length;
}
`;

// =============================================================================
// 3. Validation (dry run — no DB writes)
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

// Normalize phone / numbers to clean strings
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
  // Try ISO first
  if (/^\\d{4}-\\d{2}-\\d{2}/.test(v)) return v.slice(0, 10);
  // Try MM/DD/YYYY
  const m1 = v.match(/^(\\d{1,2})\\/(\\d{1,2})\\/(\\d{4})$/);
  if (m1) {
    const [, mm, dd, yyyy] = m1;
    return yyyy + "-" + mm.padStart(2, "0") + "-" + dd.padStart(2, "0");
  }
  // Try YYYY/MM/DD
  const m2 = v.match(/^(\\d{4})\\/(\\d{1,2})\\/(\\d{1,2})$/);
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
        skipReason = "Property \\"" + name + "\\" already exists";
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
            message: "Property \\"" + propName + "\\" not found",
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
            message: "Property \\"" + propName + "\\" not found",
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
            message: field.label + " is not a valid number: \\"" + mapped[field.key] + "\\"",
          });
        }
      }
      if (field.type === "date" && mapped[field.key]) {
        if (parseDate(mapped[field.key]!) === null) {
          errors.push({
            rowIndex: index,
            field: field.key,
            message: field.label + " is not a valid date: \\"" + mapped[field.key] + "\\"",
          });
        }
      }
      if (field.type === "enum" && mapped[field.key] && field.enumValues) {
        const v = mapped[field.key]!.toLowerCase();
        if (!field.enumValues.includes(v)) {
          warnings.push(
            field.label + ": \\"" + mapped[field.key] + "\\" not in list — will use default"
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
// 4. Target picker
// =============================================================================
FILES["src/components/import/target-picker.tsx"] =
`"use client";

import { Building2, DoorOpen, Users, FileText } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { TARGETS } from "@/lib/import/field-defs";
import type { TargetTable } from "@/lib/import/types";

const ICONS: Record<TargetTable, React.ComponentType<{ className?: string }>> = {
  properties: Building2,
  units: DoorOpen,
  tenants: Users,
  leases: FileText,
};

export function TargetPicker({
  value,
  onChange,
}: {
  value: TargetTable | null;
  onChange: (v: TargetTable) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {TARGETS.map((t) => {
        const Icon = ICONS[t.key];
        const active = value === t.key;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={cn(
              "flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors",
              active
                ? "border-brand-500 bg-brand-500/5"
                : "border-ink-200 bg-surface hover:border-ink-300 dark:border-white/[0.06] dark:hover:border-white/[0.12]"
            )}
          >
            <div
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg",
                active
                  ? "bg-brand-500 text-white"
                  : "bg-brand-500/10 text-brand-600 dark:text-brand-400"
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink-900">{t.label}</p>
              <p className="mt-0.5 text-xs text-ink-500">{t.description}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
`;

// =============================================================================
// 5. Mapping form
// =============================================================================
FILES["src/components/import/mapping-form.tsx"] =
`"use client";

import { AlertCircle } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { getTarget } from "@/lib/import/field-defs";
import type { ColumnMapping, TargetTable } from "@/lib/import/types";

export function MappingForm({
  target,
  headers,
  mapping,
  onChange,
}: {
  target: TargetTable;
  headers: string[];
  mapping: ColumnMapping;
  onChange: (m: ColumnMapping) => void;
}) {
  const def = getTarget(target);
  if (!def) return null;

  const options = [
    { value: "", label: "— Not mapped —" },
    ...headers.map((h) => ({ value: h, label: h })),
  ];

  return (
    <Card>
      <CardHeader
        title="Column mapping"
        description={"Match each field to a column from your file."}
      />
      <CardBody className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {def.fields.map((field) => {
          const current = mapping[field.key] ?? "";
          return (
            <div key={field.key}>
              <div className="mb-1.5 flex items-center gap-2">
                <span className="text-sm font-medium text-ink-700">
                  {field.label}
                </span>
                {field.required ? (
                  <Badge tone="red">required</Badge>
                ) : (
                  <Badge tone="gray">optional</Badge>
                )}
              </div>
              <Select
                options={options}
                value={current}
                onChange={(e) => {
                  const next = { ...mapping };
                  next[field.key] = e.target.value || null;
                  onChange(next);
                }}
              />
              {field.hint && (
                <p className="mt-1 flex items-start gap-1 text-xs text-ink-500">
                  <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                  {field.hint}
                </p>
              )}
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}
`;

// =============================================================================
// 6. Validation summary
// =============================================================================
FILES["src/components/import/validation-summary.tsx"] =
`import { CheckCircle2, AlertCircle, AlertTriangle, Info } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ImportPreviewRow } from "@/lib/import/types";

export function ValidationSummary({ rows }: { rows: ImportPreviewRow[] }) {
  const valid = rows.filter((r) => r.errors.length === 0 && !r.willSkip);
  const skipped = rows.filter((r) => r.willSkip);
  const invalid = rows.filter((r) => r.errors.length > 0);
  const withWarnings = rows.filter((r) => r.warnings.length > 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat
          icon={CheckCircle2}
          tone="success"
          label="Ready to import"
          value={valid.length}
        />
        <Stat
          icon={Info}
          tone="info"
          label="Duplicates (skip)"
          value={skipped.length}
        />
        <Stat
          icon={AlertCircle}
          tone="danger"
          label="Errors"
          value={invalid.length}
        />
        <Stat
          icon={AlertTriangle}
          tone="warning"
          label="With warnings"
          value={withWarnings.length}
        />
      </div>

      {invalid.length > 0 && (
        <Card>
          <CardBody className="p-0">
            <div className="border-b border-ink-200 px-5 py-3 dark:border-white/[0.06]">
              <p className="text-sm font-medium text-danger-700 dark:text-danger-500">
                {invalid.length} row{invalid.length === 1 ? "" : "s"} have errors and will be skipped
              </p>
            </div>
            <ul className="divide-y divide-ink-100 dark:divide-white/[0.04] max-h-64 overflow-y-auto">
              {invalid.slice(0, 50).map((r) => (
                <li key={r.index} className="flex items-start gap-3 px-5 py-2.5 text-sm">
                  <Badge tone="red">Row {r.index + 2}</Badge>
                  <div className="min-w-0 flex-1">
                    {r.errors.map((e, i) => (
                      <p key={i} className="text-danger-700 dark:text-danger-500">
                        {e.message}
                      </p>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
            {invalid.length > 50 && (
              <div className="border-t border-ink-200 px-5 py-2 text-center text-xs text-ink-500 dark:border-white/[0.06]">
                + {invalid.length - 50} more
              </div>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function Stat({
  icon: Icon,
  tone,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: "success" | "info" | "danger" | "warning";
  label: string;
  value: number;
}) {
  const colors = {
    success: "text-success-700 dark:text-success-500",
    info: "text-info-700 dark:text-info-500",
    danger: "text-danger-700 dark:text-danger-500",
    warning: "text-warning-700 dark:text-warning-500",
  };
  const bg = {
    success: "bg-success-500/10",
    info: "bg-info-500/10",
    danger: "bg-danger-500/10",
    warning: "bg-warning-500/10",
  };
  return (
    <Card>
      <CardBody className="flex items-center gap-3">
        <div className={"flex h-9 w-9 items-center justify-center rounded-lg " + bg[tone] + " " + colors[tone]}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xs text-ink-500">{label}</p>
          <p className="text-lg font-semibold text-ink-900">{value}</p>
        </div>
      </CardBody>
    </Card>
  );
}
`;

// =============================================================================
// 7. Updated server actions
// =============================================================================
FILES["src/app/(dashboard)/property/import/actions.ts"] =
`"use server";

import { assertPermission } from "@/lib/auth/guard";
import {
  parseCsvText,
  parseXlsxBuffer,
  fetchSheetsCsv,
  buildParsedSheet,
} from "@/lib/import/parse";
import { toSheetsCsvUrl } from "@/lib/import/sheets-url";
import { validateImport } from "@/lib/import/validate";
import { getTarget } from "@/lib/import/field-defs";
import type {
  ColumnMapping,
  ImportPreviewRow,
  ParsedSheet,
  TargetTable,
} from "@/lib/import/types";
import type { ActionResult } from "@/lib/actions/result";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

export async function parseImportSourceAction(
  formData: FormData
): Promise<ActionResult<ParsedSheet>> {
  await assertPermission("unit:create");

  const file = formData.get("file") as File | null;
  const sheetsUrl = (formData.get("sheets_url") as string | null)?.trim();

  try {
    if (sheetsUrl) {
      const csvUrl = toSheetsCsvUrl(sheetsUrl);
      if (!csvUrl) return { ok: false, error: "Not a valid Google Sheets URL" };
      const { headers, rows } = await fetchSheetsCsv(csvUrl);
      if (headers.length === 0) return { ok: false, error: "Sheet appears empty" };
      return {
        ok: true,
        data: buildParsedSheet({ source: "sheets", filename: "Google Sheet", headers, rows }),
      };
    }

    if (!file) return { ok: false, error: "No file uploaded" };
    if (file.size > MAX_FILE_BYTES) return { ok: false, error: "File exceeds 10 MB limit" };

    const name = file.name.toLowerCase();

    if (name.endsWith(".csv")) {
      const text = await file.text();
      const { headers, rows } = parseCsvText(text);
      if (headers.length === 0) return { ok: false, error: "CSV appears empty or missing a header row" };
      return {
        ok: true,
        data: buildParsedSheet({ source: "csv", filename: file.name, headers, rows }),
      };
    }

    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      const buf = Buffer.from(await file.arrayBuffer());
      const { headers, rows } = parseXlsxBuffer(buf);
      if (headers.length === 0) return { ok: false, error: "Workbook appears empty" };
      return {
        ok: true,
        data: buildParsedSheet({ source: "xlsx", filename: file.name, headers, rows }),
      };
    }

    return { ok: false, error: "Unsupported file type. Use CSV, XLSX, or XLS." };
  } catch (err) {
    console.error("[parseImportSource]", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to parse file",
    };
  }
}

export async function validateImportAction(input: {
  target: TargetTable;
  mapping: ColumnMapping;
  rows: Record<string, string>[];
}): Promise<ActionResult<ImportPreviewRow[]>> {
  const def = getTarget(input.target);
  if (!def) return { ok: false, error: "Unknown target table" };
  await assertPermission(def.permission);

  try {
    const rows = await validateImport({
      target: input.target,
      mapping: input.mapping,
      rows: input.rows,
    });
    return { ok: true, data: rows };
  } catch (err) {
    console.error("[validateImportAction]", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Validation failed",
    };
  }
}
`;

// =============================================================================
// 8. Updated wizard (adds Pass 2 UI)
// =============================================================================
FILES["src/components/import/wizard.tsx"] =
`"use client";

import { useEffect, useState, useTransition } from "react";
import { ArrowRight } from "lucide-react";
import { SourcePicker } from "./source-picker";
import { PreviewTable } from "./preview-table";
import { StepIndicator } from "./step-indicator";
import { TargetPicker } from "./target-picker";
import { MappingForm } from "./mapping-form";
import { ValidationSummary } from "./validation-summary";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { autoMapColumns } from "@/lib/import/auto-map";
import { getTarget } from "@/lib/import/field-defs";
import { validateImportAction } from "@/app/(dashboard)/property/import/actions";
import type {
  ColumnMapping,
  ImportPreviewRow,
  ImportStep,
  ParsedSheet,
  TargetTable,
} from "@/lib/import/types";

export function ImportWizard() {
  const [step, setStep] = useState<ImportStep>("source");
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [target, setTarget] = useState<TargetTable | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [preview, setPreview] = useState<ImportPreviewRow[] | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();

  // Recompute mapping when target changes
  useEffect(() => {
    if (sheet && target) {
      setMapping(autoMapColumns(target, sheet.headers));
    }
  }, [sheet, target]);

  function handleParsed(parsed: ParsedSheet) {
    setSheet(parsed);
    setStep("map");
  }

  function reset() {
    setSheet(null);
    setTarget(null);
    setMapping({});
    setPreview(null);
    setStep("source");
  }

  function runValidation() {
    if (!sheet || !target) return;
    start(async () => {
      const result = await validateImportAction({
        target,
        mapping,
        rows: sheet.rows,
      });
      if (result.ok) {
        setPreview(result.data);
        setStep("review");
      } else {
        toast.push(result.error, "error");
      }
    });
  }

  // Check required fields are mapped before validating
  const def = target ? getTarget(target) : null;
  const missingRequired =
    def?.fields.filter((f) => f.required && !mapping[f.key]) ?? [];

  return (
    <div className="space-y-6">
      <StepIndicator current={step} />

      {/* STEP 1 — Source */}
      {step === "source" && <SourcePicker onParsed={handleParsed} />}

      {/* STEP 2 — Map */}
      {step === "map" && sheet && (
        <div className="space-y-6">
          <PreviewTable sheet={sheet} maxRows={10} />

          <Card>
            <CardHeader
              title="What are you importing?"
              description="Pick the table these rows should go into."
            />
            <CardBody>
              <TargetPicker value={target} onChange={setTarget} />
            </CardBody>
          </Card>

          {target && (
            <MappingForm
              target={target}
              headers={sheet.headers}
              mapping={mapping}
              onChange={setMapping}
            />
          )}

          <div className="flex items-center justify-between gap-2">
            <Button variant="secondary" onClick={reset}>
              Choose different file
            </Button>
            <div className="flex items-center gap-3">
              {missingRequired.length > 0 && (
                <span className="text-xs text-danger-700 dark:text-danger-500">
                  Map required fields: {missingRequired.map((f) => f.label).join(", ")}
                </span>
              )}
              <Button
                onClick={runValidation}
                loading={pending}
                disabled={!target || missingRequired.length > 0}
              >
                Validate {sheet.totalRows} rows
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3 — Review */}
      {step === "review" && preview && (
        <div className="space-y-6">
          <ValidationSummary rows={preview} />

          <div className="rounded-xl border border-warning-500/20 bg-warning-50 p-4 text-sm text-warning-700 dark:border-warning-500/20 dark:bg-warning-500/10 dark:text-warning-500">
            <strong>Pass 3 coming next:</strong> the actual import (database
            write) + summary. For now this shows what would be inserted.
          </div>

          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep("map")}>
              Back to mapping
            </Button>
            <Button variant="secondary" onClick={reset}>
              Start over
            </Button>
          </div>
        </div>
      )}
    </div>
  );
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

  console.log("CSV/XLSX/Sheets Importer — Pass 2\n");

  let count = 0;
  for (const [relPath, content] of Object.entries(FILES)) {
    const full = join(ROOT, relPath);
    const exists_ = await exists(full);
    console.log((exists_ ? "  ~ " : "  + ") + relPath);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, content, "utf8");
    count++;
  }

  console.log("\nDone — " + count + " file(s) written.\n");
  console.log("Next:");
  console.log("  npm run typecheck");
  console.log("  npm run dev");
  console.log("  Visit http://localhost:3000/property/import");
  console.log("\nTest flow:");
  console.log("  1. Upload your CSV/XLSX or paste a Google Sheets URL");
  console.log("  2. Pick target table (Units / Tenants / Leases / Properties)");
  console.log("  3. Verify auto-mapped columns, override if needed");
  console.log("  4. Click 'Validate N rows' to see the dry-run preview");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});