#!/usr/bin/env node
/**
 * CSV/XLSX/Sheets Importer — Pass 3 (Commit + Summary)
 * Usage: node scaffold-import-pass3.mjs
 *
 * Creates:
 *   src/lib/import/commit.ts
 *   src/components/import/confirm-bar.tsx
 *   src/components/import/import-summary.tsx
 *
 * Updates:
 *   src/app/(dashboard)/property/import/actions.ts  (add commitImportAction)
 *   src/components/import/wizard.tsx                (wire Pass 3 step)
 *   src/lib/events/registry.ts                      (add import.completed handler)
 *   src/lib/events/consumers/import-completed.ts    (new consumer)
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
// 1. Commit engine (server-side)
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

// ---- value parsers ----

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
`;

// =============================================================================
// 2. Import summary card
// =============================================================================
FILES["src/components/import/import-summary.tsx"] =
`import Link from "next/link";
import { CheckCircle2, AlertCircle, Info, XCircle } from "lucide-react";
import { Card, CardBody, CardHeader, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ImportSummary } from "@/lib/import/types";

const LABEL: Record<string, string> = {
  properties: "Properties",
  units: "Units",
  tenants: "Tenants",
  leases: "Leases",
};

const BACK: Record<string, string> = {
  properties: "/property/properties",
  units: "/property/units",
  tenants: "/property/tenants",
  leases: "/property/leases",
};

export function ImportSummaryCard({ summary }: { summary: ImportSummary }) {
  return (
    <Card>
      <CardHeader
        title="Import complete"
        description={"Imported into " + (LABEL[summary.target] ?? summary.target)}
      />
      <CardBody className="space-y-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat icon={CheckCircle2} tone="success" label="Created" value={summary.created} />
          <Stat icon={Info} tone="info" label="Updated" value={summary.updated} />
          <Stat icon={AlertCircle} tone="warning" label="Skipped" value={summary.skipped} />
          <Stat icon={XCircle} tone="danger" label="Failed" value={summary.failed} />
        </div>

        {summary.errors.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium text-ink-800">
              Errors ({summary.errors.length})
            </p>
            <ul className="divide-y divide-ink-100 rounded-lg border border-ink-200 dark:divide-white/[0.04] dark:border-white/[0.06] max-h-64 overflow-y-auto">
              {summary.errors.slice(0, 100).map((e, i) => (
                <li key={i} className="flex items-start gap-3 px-4 py-2.5 text-sm">
                  <Badge tone="red">Row {e.rowIndex + 2}</Badge>
                  <span className="min-w-0 flex-1 text-danger-700 dark:text-danger-500">
                    {e.message}
                  </span>
                </li>
              ))}
            </ul>
            {summary.errors.length > 100 && (
              <p className="mt-2 text-xs text-ink-500">
                + {summary.errors.length - 100} more errors
              </p>
            )}
          </div>
        )}
      </CardBody>
      <CardFooter>
        <Link href={BACK[summary.target] ?? "/property/units"}>
          <Button variant="secondary">Back to list</Button>
        </Link>
        <Link href="/property/import">
          <Button>Import another file</Button>
        </Link>
      </CardFooter>
    </Card>
  );
}

function Stat({
  icon: Icon,
  tone,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: "success" | "info" | "warning" | "danger";
  label: string;
  value: number;
}) {
  const colors = {
    success: "text-success-700 dark:text-success-500 bg-success-500/10",
    info: "text-info-700 dark:text-info-500 bg-info-500/10",
    warning: "text-warning-700 dark:text-warning-500 bg-warning-500/10",
    danger: "text-danger-700 dark:text-danger-500 bg-danger-500/10",
  };
  return (
    <div className="flex items-center gap-3 rounded-lg border border-ink-200 bg-surface p-3 dark:border-white/[0.06]">
      <div className={"flex h-9 w-9 items-center justify-center rounded-lg " + colors[tone]}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xs text-ink-500">{label}</p>
        <p className="text-lg font-semibold text-ink-900">{value}</p>
      </div>
    </div>
  );
}
`;

// =============================================================================
// 3. Confirm bar
// =============================================================================
FILES["src/components/import/confirm-bar.tsx"] =
`"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ConfirmBar({
  readyCount,
  skipCount,
  errorCount,
  pending,
  onConfirm,
}: {
  readyCount: number;
  skipCount: number;
  errorCount: number;
  pending: boolean;
  onConfirm: (updateDuplicates: boolean) => void;
}) {
  const [updateDuplicates, setUpdateDuplicates] = useState(false);

  return (
    <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-ink-200 bg-surface p-5 md:flex-row md:items-center dark:border-white/[0.06]">
      <div>
        <p className="text-sm font-medium text-ink-900">
          Ready to import {readyCount} row{readyCount === 1 ? "" : "s"}
        </p>
        <p className="mt-0.5 text-xs text-ink-500">
          {skipCount > 0 && (skipCount + " duplicate" + (skipCount === 1 ? "" : "s") + " will be " + (updateDuplicates ? "updated" : "skipped"))}
          {skipCount > 0 && errorCount > 0 && " · "}
          {errorCount > 0 && (errorCount + " row" + (errorCount === 1 ? "" : "s") + " will fail")}
          {skipCount === 0 && errorCount === 0 && "No duplicates or errors"}
        </p>
      </div>

      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
        {skipCount > 0 && (
          <label className="flex items-center gap-2 text-xs text-ink-600">
            <input
              type="checkbox"
              checked={updateDuplicates}
              onChange={(e) => setUpdateDuplicates(e.target.checked)}
              className="h-4 w-4 rounded border-ink-300 text-brand-500 focus:ring-brand-500"
            />
            Update existing instead of skip
          </label>
        )}
        <Button
          onClick={() => onConfirm(updateDuplicates)}
          loading={pending}
          disabled={readyCount === 0 && skipCount === 0}
        >
          <Upload className="mr-1.5 h-3.5 w-3.5" />
          Import now
        </Button>
      </div>
    </div>
  );
}
`;

// =============================================================================
// 4. Update actions.ts
// =============================================================================
FILES["src/app/(dashboard)/property/import/actions.ts"] =
`"use server";

import { revalidatePath } from "next/cache";
import { assertPermission } from "@/lib/auth/guard";
import { getSession } from "@/lib/auth/get-session";
import {
  parseCsvText,
  parseXlsxBuffer,
  fetchSheetsCsv,
  buildParsedSheet,
} from "@/lib/import/parse";
import { toSheetsCsvUrl } from "@/lib/import/sheets-url";
import { validateImport } from "@/lib/import/validate";
import { commitImport } from "@/lib/import/commit";
import { getTarget } from "@/lib/import/field-defs";
import { logAudit } from "@/lib/audit/log";
import { emit } from "@/lib/events/emit";
import type {
  ColumnMapping,
  ImportPreviewRow,
  ImportSummary,
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

export async function commitImportAction(input: {
  target: TargetTable;
  mapping: ColumnMapping;
  rows: Record<string, string>[];
  preview: ImportPreviewRow[];
  updateDuplicates: boolean;
}): Promise<ActionResult<ImportSummary>> {
  const def = getTarget(input.target);
  if (!def) return { ok: false, error: "Unknown target table" };
  await assertPermission(def.permission);

  const session = await getSession();

  try {
    const summary = await commitImport({
      target: input.target,
      mapping: input.mapping,
      rows: input.rows,
      preview: input.preview,
      updateDuplicates: input.duplicates ?? input.updateDuplicates,
      actor_id: session?.id ?? null,
    });

    await logAudit({
      actor_id: session?.id ?? null,
      entity_type: "import",
      entity_id: "00000000-0000-0000-0000-000000000000",
      action: "create",
      after: {
        target: input.target,
        total: summary.totalRows,
        created: summary.created,
        updated: summary.updated,
        skipped: summary.skipped,
        failed: summary.failed,
      },
      reason: "bulk import",
    });

    await emit("import.completed", {
      target: input.target,
      created: summary.created,
      updated: summary.updated,
      skipped: summary.skipped,
      failed: summary.failed,
    }, session?.id ?? null);

    // Revalidate affected list pages
    revalidatePath("/property/properties");
    revalidatePath("/property/units");
    revalidatePath("/property/tenants");
    revalidatePath("/property/leases");

    return { ok: true, data: summary };
  } catch (err) {
    console.error("[commitImportAction]", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Import failed",
    };
  }
}
`;

// =============================================================================
// 5. Updated wizard — adds confirm + summary step
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
import { ConfirmBar } from "./confirm-bar";
import { ImportSummaryCard } from "./import-summary";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { autoMapColumns } from "@/lib/import/auto-map";
import { getTarget } from "@/lib/import/field-defs";
import {
  validateImportAction,
  commitImportAction,
} from "@/app/(dashboard)/property/import/actions";
import type {
  ColumnMapping,
  ImportPreviewRow,
  ImportStep,
  ImportSummary,
  ParsedSheet,
  TargetTable,
} from "@/lib/import/types";

export function ImportWizard() {
  const [step, setStep] = useState<ImportStep>("source");
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [target, setTarget] = useState<TargetTable | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [preview, setPreview] = useState<ImportPreviewRow[] | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();

  useEffect(() => {
    if (sheet && target) setMapping(autoMapColumns(target, sheet.headers));
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
    setSummary(null);
    setStep("source");
  }

  function runValidation() {
    if (!sheet || !target) return;
    start(async () => {
      const result = await validateImportAction({ target, mapping, rows: sheet.rows });
      if (result.ok) {
        setPreview(result.data);
        setStep("review");
      } else toast.push(result.error, "error");
    });
  }

  function runCommit(updateDuplicates: boolean) {
    if (!sheet || !target || !preview) return;
    start(async () => {
      const result = await commitImportAction({
        target,
        mapping,
        rows: sheet.rows,
        preview,
        updateDuplicates,
      });
      if (result.ok) {
        setSummary(result.data);
        setStep("done");
        toast.push(
          "Import complete — " + result.data.created + " created",
          "success"
        );
      } else toast.push(result.error, "error");
    });
  }

  const def = target ? getTarget(target) : null;
  const missingRequired = def?.fields.filter((f) => f.required && !mapping[f.key]) ?? [];

  return (
    <div className="space-y-6">
      <StepIndicator current={step} />

      {step === "source" && <SourcePicker onParsed={handleParsed} />}

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
                  Map required: {missingRequired.map((f) => f.label).join(", ")}
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

      {step === "review" && preview && (
        <div className="space-y-6">
          <ValidationSummary rows={preview} />
          <ConfirmBar
            readyCount={preview.filter((r) => r.errors.length === 0 && !r.willSkip).length}
            skipCount={preview.filter((r) => r.willSkip).length}
            errorCount={preview.filter((r) => r.errors.length > 0).length}
            pending={pending}
            onConfirm={runCommit}
          />
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

      {step === "done" && summary && <ImportSummaryCard summary={summary} />}
    </div>
  );
}
`;

// =============================================================================
// 6. Consumer + registry entry
// =============================================================================
FILES["src/lib/events/consumers/import-completed.ts"] =
`import "server-only";

export async function onImportCompleted(_payload: {
  target: string;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
}) {
  // Reserved for notifications, dashboards, etc.
}
`;

FILES["src/lib/events/registry.ts"] =
`import { onLeaseSigned } from "./consumers/lease-signed";
import { onLeaseCreated } from "./consumers/lease-created";
import { onLeaseTerminated } from "./consumers/lease-terminated";
import { onTenantCreated } from "./consumers/tenant-created";
import { onJobOrderCreated } from "./consumers/joborder-created";
import { onJobOrderCostApproved } from "./consumers/joborder-cost-approved";
import { onJobOrderCostRejected } from "./consumers/joborder-cost-rejected";
import { onJobOrderCompleted } from "./consumers/joborder-completed";
import { onInvoicePaid } from "./consumers/invoice-paid";
import { onImportCompleted } from "./consumers/import-completed";

export const handlers: Record<string, (payload: any) => Promise<void>> = {
  "tenant.created": onTenantCreated,
  "lease.created": onLeaseCreated,
  "lease.signed": onLeaseSigned,
  "lease.terminated": onLeaseTerminated,
  "joborder.created": onJobOrderCreated,
  "joborder.cost_approved": onJobOrderCostApproved,
  "joborder.cost_rejected": onJobOrderCostRejected,
  "joborder.completed": onJobOrderCompleted,
  "invoice.paid": onInvoicePaid,
  "import.completed": onImportCompleted,
};
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

  console.log("CSV/XLSX/Sheets Importer — Pass 3\n");

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
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});