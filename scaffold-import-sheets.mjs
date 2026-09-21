#!/usr/bin/env node
/**
 * Importer enhancement — XLSX multi-sheet picker
 * Usage: node scaffold-import-sheets.mjs
 *
 * Updates:
 *   src/lib/import/types.ts               (add sheet metadata to ParsedSheet)
 *   src/lib/import/parse.ts                (parseXlsxAllSheets, keep parseXlsxBuffer)
 *   src/app/(dashboard)/property/import/actions.ts
 *                                          (parseImportSourceAction returns sheet list;
 *                                           add parseSheetByNameAction)
 *   src/components/import/source-picker.tsx (accept sheetNames in callback)
 *   src/components/import/preview-table.tsx (show active sheet name)
 *   src/components/import/sheet-picker.tsx  (new component)
 *   src/components/import/wizard.tsx        (wire sheet switching)
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
// 1. types.ts
// =============================================================================
FILES["src/lib/import/types.ts"] =
`export type ImportSource = "csv" | "xlsx" | "sheets";

export type ParsedSheet = {
  source: ImportSource;
  filename: string;
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
  /** Available sheet/tab names when the source has multiple (XLSX). */
  sheetNames?: string[];
  /** Name of the sheet/tab currently loaded. */
  activeSheet?: string;
};

export type ImportStep = "source" | "map" | "review" | "done";

export type TargetTable = "units" | "tenants" | "leases" | "properties";

export type ColumnMapping = Record<string, string | null>;

export type RowError = {
  rowIndex: number;
  field?: string;
  message: string;
};

export type ImportPreviewRow = {
  index: number;
  source: Record<string, string>;
  mapped: Record<string, string | null>;
  errors: RowError[];
  warnings: string[];
  willSkip: boolean;
  skipReason?: string;
};

export type ImportSummary = {
  target: TargetTable;
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: RowError[];
};
`;

// =============================================================================
// 2. parse.ts — add all-sheets reader
// =============================================================================
FILES["src/lib/import/parse.ts"] =
`import "server-only";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { ImportSource, ParsedSheet } from "./types";

export function parseCsvText(text: string): {
  headers: string[];
  rows: Record<string, string>[];
} {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
    transform: (v) => (typeof v === "string" ? v.trim() : String(v ?? "")),
  });

  const headers = (result.meta.fields ?? []).filter(Boolean);
  const rows = (result.data ?? []).filter((r) =>
    Object.values(r).some((v) => v !== "")
  );
  return { headers, rows };
}

export type RawSheet = {
  name: string;
  headers: string[];
  rows: Record<string, string>[];
};

/**
 * Parse every sheet in an XLSX/XLS workbook.
 */
export function parseXlsxAllSheets(buffer: Buffer): RawSheet[] {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const out: RawSheet[] = [];

  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    if (!sheet) continue;

    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
      raw: false,
    });

    // Skip completely empty sheets
    if (json.length === 0) {
      out.push({ name, headers: [], rows: [] });
      continue;
    }

    const headers = Object.keys(json[0]).map((h) => String(h).trim());
    const rows = json
      .map((r) => {
        const out: Record<string, string> = {};
        for (const h of Object.keys(r)) {
          out[String(h).trim()] = String(r[h] ?? "").trim();
        }
        return out;
      })
      .filter((r) => Object.values(r).some((v) => v !== ""));

    out.push({ name, headers, rows });
  }

  return out;
}

/**
 * Backward-compat single-sheet parser (first non-empty sheet).
 */
export function parseXlsxBuffer(buffer: Buffer): {
  headers: string[];
  rows: Record<string, string>[];
} {
  const sheets = parseXlsxAllSheets(buffer);
  const first =
    sheets.find((s) => s.headers.length > 0) ?? sheets[0] ?? null;
  if (!first) return { headers: [], rows: [] };
  return { headers: first.headers, rows: first.rows };
}

export async function fetchSheetsCsv(csvUrl: string): Promise<{
  headers: string[];
  rows: Record<string, string>[];
}> {
  const res = await fetch(csvUrl, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(
      "Failed to fetch the sheet. Make sure it's shared as 'Anyone with the link can view'."
    );
  }
  const text = await res.text();
  return parseCsvText(text);
}

export function buildParsedSheet(input: {
  source: ImportSource;
  filename: string;
  headers: string[];
  rows: Record<string, string>[];
  sheetNames?: string[];
  activeSheet?: string;
}): ParsedSheet {
  return {
    source: input.source,
    filename: input.filename,
    headers: input.headers,
    rows: input.rows,
    totalRows: input.rows.length,
    sheetNames: input.sheetNames,
    activeSheet: input.activeSheet,
  };
}
`;

// =============================================================================
// 3. actions.ts — extend parser + add sheet switch
// =============================================================================
FILES["src/app/(dashboard)/property/import/actions.ts"] =
`"use server";

import { revalidatePath } from "next/cache";
import { assertPermission } from "@/lib/auth/guard";
import { getSession } from "@/lib/auth/get-session";
import {
  parseCsvText,
  parseXlsxAllSheets,
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

// Cache parsed workbooks in memory keyed by an opaque id. The file isn't
// kept around, only the parsed sheets — but we don't want to re-parse on
// every sheet switch.
type SheetCache = Map<string, { sheets: ReturnType<typeof parseXlsxAllSheets>; filename: string }>;
const globalForSheets = globalThis as unknown as { __importSheetCache?: SheetCache };
const sheetCache = (globalForSheets.__importSheetCache ??= new Map());

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
      const sheets = parseXlsxAllSheets(buf);
      const nonEmpty = sheets.filter((s) => s.headers.length > 0);
      if (nonEmpty.length === 0) return { ok: false, error: "Workbook has no data" };

      // Cache for later sheet switching
      const token = "xlsx_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10);
      sheetCache.set(token, { sheets, filename: file.name });

      const active = nonEmpty[0];
      return {
        ok: true,
        data: buildParsedSheet({
          source: "xlsx",
          filename: file.name,
          headers: active.headers,
          rows: active.rows,
          sheetNames: nonEmpty.map((s) => s.name),
          activeSheet: active.name,
        }),
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

/**
 * Re-parse a specific sheet from the cached workbook.
 * Used when the user switches tabs.
 */
export async function parseSheetByNameAction(input: {
  filename: string;
  sheet_name: string;
}): Promise<ActionResult<ParsedSheet>> {
  await assertPermission("unit:create");

  // Find the cached entry by filename (latest wins)
  let found: { sheets: ReturnType<typeof parseXlsxAllSheets>; filename: string } | null = null;
  for (const entry of sheetCache.values()) {
    if (entry.filename === input.filename) {
      found = entry;
    }
  }
  if (!found) {
    return { ok: false, error: "Session expired — please re-upload the file." };
  }

  const sheet = found.sheets.find((s) => s.name === input.sheet_name);
  if (!sheet) return { ok: false, error: "Sheet not found: " + input.sheet_name };
  if (sheet.headers.length === 0) {
    return { ok: false, error: "Sheet \\"" + input.sheet_name + "\\" is empty" };
  }

  return {
    ok: true,
    data: buildParsedSheet({
      source: "xlsx",
      filename: input.filename,
      headers: sheet.headers,
      rows: sheet.rows,
      sheetNames: found.sheets.filter((s) => s.headers.length > 0).map((s) => s.name),
      activeSheet: sheet.name,
    }),
  };
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
      updateDuplicates: input.updateDuplicates,
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
// 4. sheet-picker.tsx — new component
// =============================================================================
FILES["src/components/import/sheet-picker.tsx"] =
`"use client";

import { useTransition } from "react";
import { Loader2, Table2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/components/ui/toast";
import { parseSheetByNameAction } from "@/app/(dashboard)/property/import/actions";
import type { ParsedSheet } from "@/lib/import/types";

export function SheetPicker({
  filename,
  sheetNames,
  activeSheet,
  onSwitch,
}: {
  filename: string;
  sheetNames: string[];
  activeSheet?: string;
  onSwitch: (sheet: ParsedSheet) => void;
}) {
  const [pending, start] = useTransition();
  const toast = useToast();

  function handleSwitch(name: string) {
    if (name === activeSheet) return;
    start(async () => {
      const result = await parseSheetByNameAction({
        filename,
        sheet_name: name,
      });
      if (result.ok) {
        onSwitch(result.data);
        toast.push("Loaded sheet: " + name, "success");
      } else {
        toast.push(result.error, "error");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-ink-200 bg-surface p-2 dark:border-white/[0.06]">
      <div className="flex items-center gap-1.5 px-2 text-xs font-medium text-ink-500">
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Table2 className="h-3.5 w-3.5" />
        )}
        Sheet
      </div>
      {sheetNames.map((name) => {
        const active = name === activeSheet;
        return (
          <button
            key={name}
            onClick={() => handleSwitch(name)}
            disabled={pending}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-brand-500 text-white shadow-sm"
                : "text-ink-600 hover:bg-ink-100 dark:hover:bg-white/[0.05]",
              pending && "opacity-60 cursor-not-allowed"
            )}
          >
            {name}
          </button>
        );
      })}
    </div>
  );
}
`;

// =============================================================================
// 5. preview-table.tsx — show active sheet name in header
// =============================================================================
FILES["src/components/import/preview-table.tsx"] =
`import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ParsedSheet } from "@/lib/import/types";

export function PreviewTable({ sheet, maxRows = 20 }: { sheet: ParsedSheet; maxRows?: number }) {
  const preview = sheet.rows.slice(0, maxRows);
  const hasMore = sheet.rows.length > maxRows;

  const desc = sheet.activeSheet
    ? "Sheet \\"" + sheet.activeSheet + "\\" · showing " + preview.length + " of " + sheet.totalRows
    : "Showing first " + preview.length + " of " + sheet.totalRows + " rows";

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Preview"
        description={desc}
        action={
          <Badge tone="brand">
            {sheet.source.toUpperCase()} · {sheet.headers.length} columns
          </Badge>
        }
      />
      <CardBody className="p-0">
        <Table>
          <THead>
            <TR>
              <TH className="w-12 text-right">#</TH>
              {sheet.headers.map((h) => (
                <TH key={h}>{h}</TH>
              ))}
            </TR>
          </THead>
          <TBody>
            {preview.map((row, i) => (
              <TR key={i}>
                <TD className="text-right text-xs text-ink-400">{i + 1}</TD>
                {sheet.headers.map((h) => (
                  <TD key={h} className="max-w-xs truncate">
                    {row[h] ?? ""}
                  </TD>
                ))}
              </TR>
            ))}
          </TBody>
        </Table>
        {hasMore && (
          <div className="border-t border-ink-200 px-6 py-3 text-center text-xs text-ink-500 dark:border-white/[0.06]">
            + {sheet.rows.length - maxRows} more rows
          </div>
        )}
      </CardBody>
    </Card>
  );
}
`;

// =============================================================================
// 6. wizard.tsx — wire sheet switching
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
import { SheetPicker } from "./sheet-picker";
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
    setPreview(null);
    setStep("map");
  }

  function handleSheetSwitch(parsed: ParsedSheet) {
    setSheet(parsed);
    setPreview(null);
    // Recompute mapping against the new sheet's headers
    if (target) {
      setMapping(autoMapColumns(target, parsed.headers));
    }
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
        toast.push("Import complete — " + result.data.created + " created", "success");
      } else toast.push(result.error, "error");
    });
  }

  const def = target ? getTarget(target) : null;
  const missingRequired = def?.fields.filter((f) => f.required && !mapping[f.key]) ?? [];

  const hasMultipleSheets =
    sheet?.source === "xlsx" && (sheet.sheetNames?.length ?? 0) > 1;

  return (
    <div className="space-y-6">
      <StepIndicator current={step} />

      {step === "source" && <SourcePicker onParsed={handleParsed} />}

      {step === "map" && sheet && (
        <div className="space-y-6">
          {hasMultipleSheets && (
            <SheetPicker
              filename={sheet.filename}
              sheetNames={sheet.sheetNames ?? []}
              activeSheet={sheet.activeSheet}
              onSwitch={handleSheetSwitch}
            />
          )}

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
// 7. source-picker.tsx — no API change needed, callback gets sheetNames
//    (it already passes the ParsedSheet through)
// =============================================================================
FILES["src/components/import/source-picker.tsx"] =
`"use client";

import { useState, useTransition } from "react";
import { Upload, Link2, FileSpreadsheet, Loader2 } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils/cn";
import { parseImportSourceAction } from "@/app/(dashboard)/property/import/actions";
import type { ParsedSheet } from "@/lib/import/types";

type Mode = "file" | "sheets";

export function SourcePicker({
  onParsed,
}: {
  onParsed: (sheet: ParsedSheet) => void;
}) {
  const [mode, setMode] = useState<Mode>("file");
  const [sheetsUrl, setSheetsUrl] = useState("");
  const [dragging, setDragging] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();

  async function handleFile(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    start(async () => {
      const result = await parseImportSourceAction(formData);
      if (result.ok) {
        const extra =
          result.data.sheetNames && result.data.sheetNames.length > 1
            ? " · " + result.data.sheetNames.length + " sheets"
            : "";
        toast.push(
          "Parsed — " + result.data.totalRows + " rows" + extra,
          "success"
        );
        onParsed(result.data);
      } else {
        toast.push(result.error, "error");
      }
    });
  }

  async function handleSheets() {
    if (!sheetsUrl.trim()) {
      toast.push("Paste a Google Sheets URL", "error");
      return;
    }
    const formData = new FormData();
    formData.append("sheets_url", sheetsUrl.trim());
    start(async () => {
      const result = await parseImportSourceAction(formData);
      if (result.ok) {
        toast.push("Sheet parsed — " + result.data.totalRows + " rows", "success");
        onParsed(result.data);
      } else {
        toast.push(result.error, "error");
      }
    });
  }

  return (
    <Card>
      <CardBody className="space-y-6">
        <div className="flex gap-2">
          <ModeTab active={mode === "file"} onClick={() => setMode("file")} icon={Upload}>
            Upload file
          </ModeTab>
          <ModeTab active={mode === "sheets"} onClick={() => setMode("sheets")} icon={Link2}>
            Google Sheets
          </ModeTab>
        </div>

        {mode === "file" && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleFile(file);
            }}
            className={cn(
              "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-14 transition-colors",
              dragging
                ? "border-brand-500 bg-brand-500/5"
                : "border-ink-200 dark:border-white/[0.08]"
            )}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
              {pending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-5 w-5" />
              )}
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-ink-900">
                Drop a CSV or Excel file here
              </p>
              <p className="mt-1 text-xs text-ink-500">or</p>
            </div>
            <label>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
                disabled={pending}
              />
              <span className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md bg-brand-500 px-3.5 text-sm font-medium text-white transition-colors hover:bg-brand-600">
                Choose file
              </span>
            </label>
            <p className="text-xs text-ink-400">
              CSV, XLSX, XLS · Max 10 MB · Multi-tab supported
            </p>
          </div>
        )}

        {mode === "sheets" && (
          <div className="space-y-4">
            <Input
              label="Google Sheets URL"
              placeholder="https://docs.google.com/spreadsheets/d/..."
              value={sheetsUrl}
              onChange={(e) => setSheetsUrl(e.target.value)}
              hint="Sheet must be shared as 'Anyone with the link can view'. Add #gid=NNNNNN to target a specific tab."
              disabled={pending}
            />
            <Button onClick={handleSheets} loading={pending}>
              Fetch sheet
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function ModeTab({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors",
        active
          ? "border-brand-500 bg-brand-500/10 text-brand-700 dark:text-brand-400"
          : "border-ink-200 bg-surface text-ink-600 hover:border-ink-300 dark:border-white/[0.06] dark:hover:border-white/[0.12]"
      )}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
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

  console.log("Importer enhancement — XLSX multi-sheet picker\n");

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
  console.log("  Visit /property/import → upload an XLSX with multiple tabs");
  console.log("\nBehavior:");
  console.log("  - CSV & Google Sheets: unchanged");
  console.log("  - XLSX with 1 sheet: same as before");
  console.log("  - XLSX with 2+ sheets: tab picker appears above the preview");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
