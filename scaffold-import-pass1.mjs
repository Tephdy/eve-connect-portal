#!/usr/bin/env node
/**
 * CSV/XLSX/Sheets Importer — Pass 1 (Foundation + Upload)
 * Usage: node scaffold-import-pass1.mjs
 *
 * Creates:
 *   src/app/(dashboard)/property/import/page.tsx
 *   src/app/(dashboard)/property/import/actions.ts
 *   src/components/import/step-indicator.tsx
 *   src/components/import/source-picker.tsx
 *   src/components/import/preview-table.tsx
 *   src/lib/import/parse.ts
 *   src/lib/import/types.ts
 *   src/lib/import/sheets-url.ts
 *   src/lib/import/sample-data.ts
 *
 * Updates:
 *   src/app/(dashboard)/property/units/page.tsx       (add Import button)
 *   src/app/(dashboard)/property/tenants/page.tsx     (add Import button)
 *   src/app/(dashboard)/property/properties/page.tsx  (add Import button)
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
// 1. Types
// =============================================================================
FILES["src/lib/import/types.ts"] =
`export type ImportSource = "csv" | "xlsx" | "sheets";

export type ParsedSheet = {
  source: ImportSource;
  filename: string;
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
};

export type ImportStep = "source" | "map" | "review" | "done";

export type TargetTable = "units" | "tenants" | "leases" | "properties";

export type ColumnMapping = Record<string, string | null>; // target field -> source header

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
// 2. Sheets URL helpers
// =============================================================================
FILES["src/lib/import/sheets-url.ts"] =
`/**
 * Convert common Google Sheets share URLs to a CSV export URL.
 *
 * Supported input formats:
 *   https://docs.google.com/spreadsheets/d/ABC123/edit#gid=0
 *   https://docs.google.com/spreadsheets/d/ABC123/edit?gid=0#gid=0
 *   https://docs.google.com/spreadsheets/d/ABC123/edit?usp=sharing
 *   https://docs.google.com/spreadsheets/d/ABC123/
 *
 * Returns null if it doesn't look like a Google Sheets URL.
 */
export function toSheetsCsvUrl(input: string): string | null {
  const url = input.trim();
  const m = url.match(/\\/spreadsheets\\/d\\/([a-zA-Z0-9-_]+)/);
  if (!m) return null;

  const sheetId = m[1];
  const gidMatch = url.match(/[#&?]gid=(\\d+)/);
  const gid = gidMatch ? gidMatch[1] : "0";

  return \`https://docs.google.com/spreadsheets/d/\${sheetId}/export?format=csv&gid=\${gid}\`;
}

export function isSheetsUrl(input: string): boolean {
  return /^https?:\\/\\/docs\\.google\\.com\\/spreadsheets\\//.test(input.trim());
}
`;

// =============================================================================
// 3. Parser
// =============================================================================
FILES["src/lib/import/parse.ts"] =
`import "server-only";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { ImportSource, ParsedSheet } from "./types";

/**
 * Parse a raw CSV string into headers + rows.
 * Trims whitespace, skips empty lines.
 */
export function parseCsvText(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
    transform: (v) => (typeof v === "string" ? v.trim() : String(v ?? "")),
  });

  const headers = (result.meta.fields ?? []).filter(Boolean);
  const rows = (result.data ?? []).filter((r) => Object.values(r).some((v) => v !== ""));
  return { headers, rows };
}

/**
 * Parse an .xlsx or .xls buffer into headers + rows.
 * Uses the first sheet only.
 */
export function parseXlsxBuffer(buffer: Buffer): { headers: string[]; rows: Record<string, string>[] } {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) return { headers: [], rows: [] };
  const sheet = wb.Sheets[firstSheetName];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });

  if (json.length === 0) return { headers: [], rows: [] };

  const headers = Object.keys(json[0]).map((h) => String(h).trim());
  const rows = json.map((r) => {
    const out: Record<string, string> = {};
    for (const h of Object.keys(r)) {
      out[String(h).trim()] = String(r[h] ?? "").trim();
    }
    return out;
  });
  return { headers, rows };
}

/**
 * Fetch a Google Sheets CSV export URL and parse.
 */
export async function fetchSheetsCsv(csvUrl: string): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  const res = await fetch(csvUrl, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(
      "Failed to fetch the sheet. Make sure it's shared as 'Anyone with the link can view'."
    );
  }
  const text = await res.text();
  return parseCsvText(text);
}

/**
 * Master entry — takes a parsed raw result and normalizes into a ParsedSheet.
 */
export function buildParsedSheet(input: {
  source: ImportSource;
  filename: string;
  headers: string[];
  rows: Record<string, string>[];
}): ParsedSheet {
  return {
    source: input.source,
    filename: input.filename,
    headers: input.headers,
    rows: input.rows,
    totalRows: input.rows.length,
  };
}
`;

// =============================================================================
// 4. Sample data (for demo/testing)
// =============================================================================
FILES["src/lib/import/sample-data.ts"] =
`export const SAMPLE_UNITS_CSV = \`Property,Unit No,Floor,Bedrooms,Bathrooms,Sqm,Rent,Status
Eco 1,2F,2,0,1,9,5399,occupied
Eco 1,2G,2,1,1,25,8000,vacant
Eco 1,3A,3,2,2,60,15000,vacant
\`;

export const SAMPLE_TENANTS_CSV = \`Property,Unit No,Tenant Name,Email,Phone,Monthly Rent,Move-in,End of Contract
Eco 1,2F,Juan Dela Cruz,juan@x.com,09171234567,5399,2026-01-01,2026-12-31
Eco 1,2G,Maria Santos,maria@x.com,09179876543,8000,2026-02-01,2027-01-31
\`;

export const SAMPLE_PROPERTIES_CSV = \`Property,Address,Type,Total Units
Sunrise Tower,123 Sample St. Makati,residential,6
Harbor Residences,456 Bay Ave. Pasay,residential,12
\`;
`;

// =============================================================================
// 5. Step indicator
// =============================================================================
FILES["src/components/import/step-indicator.tsx"] =
`import { Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { ImportStep } from "@/lib/import/types";

const STEPS: { key: ImportStep; label: string }[] = [
  { key: "source", label: "Upload" },
  { key: "map", label: "Map columns" },
  { key: "review", label: "Review" },
  { key: "done", label: "Done" },
];

export function StepIndicator({ current }: { current: ImportStep }) {
  const currentIdx = STEPS.findIndex((s) => s.key === current);

  return (
    <div className="flex items-center gap-2">
      {STEPS.map((step, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <div key={step.key} className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                done && "bg-success-500 text-white",
                active && "bg-brand-500 text-white",
                !done && !active && "bg-ink-100 text-ink-500 dark:bg-white/[0.06]"
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span
              className={cn(
                "text-sm font-medium",
                active ? "text-ink-900" : done ? "text-ink-700" : "text-ink-400"
              )}
            >
              {step.label}
            </span>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "h-px w-8",
                  i < currentIdx ? "bg-success-500" : "bg-ink-200 dark:bg-white/[0.08]"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
`;

// =============================================================================
// 6. Source picker (client)
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
        toast.push("File parsed — " + result.data.totalRows + " rows", "success");
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
        {/* Tabs */}
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
            <p className="text-xs text-ink-400">CSV, XLSX, XLS · Max 10 MB</p>
          </div>
        )}

        {mode === "sheets" && (
          <div className="space-y-4">
            <Input
              label="Google Sheets URL"
              placeholder="https://docs.google.com/spreadsheets/d/..."
              value={sheetsUrl}
              onChange={(e) => setSheetsUrl(e.target.value)}
              hint="Sheet must be shared as 'Anyone with the link can view'"
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

// =============================================================================
// 7. Preview table
// =============================================================================
FILES["src/components/import/preview-table.tsx"] =
`import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ParsedSheet } from "@/lib/import/types";

export function PreviewTable({ sheet, maxRows = 20 }: { sheet: ParsedSheet; maxRows?: number }) {
  const preview = sheet.rows.slice(0, maxRows);
  const hasMore = sheet.rows.length > maxRows;

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Preview"
        description={
          "Showing first " + preview.length + " of " + sheet.totalRows + " rows"
        }
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
// 8. Server actions (Pass 1: parse only)
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
import type { ParsedSheet } from "@/lib/import/types";
import type { ActionResult } from "@/lib/actions/result";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

export async function parseImportSourceAction(
  formData: FormData
): Promise<ActionResult<ParsedSheet>> {
  await assertPermission("unit:create");

  const file = formData.get("file") as File | null;
  const sheetsUrl = (formData.get("sheets_url") as string | null)?.trim();

  try {
    // Sheets URL path
    if (sheetsUrl) {
      const csvUrl = toSheetsCsvUrl(sheetsUrl);
      if (!csvUrl) {
        return { ok: false, error: "Not a valid Google Sheets URL" };
      }
      const { headers, rows } = await fetchSheetsCsv(csvUrl);
      if (headers.length === 0) {
        return { ok: false, error: "Sheet appears empty" };
      }
      return {
        ok: true,
        data: buildParsedSheet({
          source: "sheets",
          filename: "Google Sheet",
          headers,
          rows,
        }),
      };
    }

    // File path
    if (!file) {
      return { ok: false, error: "No file uploaded" };
    }
    if (file.size > MAX_FILE_BYTES) {
      return { ok: false, error: "File exceeds 10 MB limit" };
    }

    const name = file.name.toLowerCase();

    if (name.endsWith(".csv")) {
      const text = await file.text();
      const { headers, rows } = parseCsvText(text);
      if (headers.length === 0) {
        return { ok: false, error: "CSV appears empty or missing a header row" };
      }
      return {
        ok: true,
        data: buildParsedSheet({
          source: "csv",
          filename: file.name,
          headers,
          rows,
        }),
      };
    }

    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      const buf = Buffer.from(await file.arrayBuffer());
      const { headers, rows } = parseXlsxBuffer(buf);
      if (headers.length === 0) {
        return { ok: false, error: "Workbook appears empty" };
      }
      return {
        ok: true,
        data: buildParsedSheet({
          source: "xlsx",
          filename: file.name,
          headers,
          rows,
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
`;

// =============================================================================
// 9. Page
// =============================================================================
FILES["src/app/(dashboard)/property/import/page.tsx"] =
`import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/guard";
import { PageHeader } from "@/components/layout/page-header";
import { StepIndicator } from "@/components/import/step-indicator";
import { ImportWizard } from "@/components/import/wizard";

export default async function ImportPage() {
  await requirePagePermission("unit:create");

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/property/units"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-ink-500 transition-colors hover:text-ink-800"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to units
        </Link>
        <PageHeader
          title="Import data"
          description="Upload a CSV, Excel file, or Google Sheet to bulk-create properties, units, tenants, or leases."
        />
      </div>

      <ImportWizard />
    </div>
  );
}
`;

// =============================================================================
// 10. Wizard (client wrapper managing step state)
// =============================================================================
FILES["src/components/import/wizard.tsx"] =
`"use client";

import { useState } from "react";
import { SourcePicker } from "./source-picker";
import { PreviewTable } from "./preview-table";
import { StepIndicator } from "./step-indicator";
import { Button } from "@/components/ui/button";
import type { ImportStep, ParsedSheet } from "@/lib/import/types";

export function ImportWizard() {
  const [step, setStep] = useState<ImportStep>("source");
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);

  function handleParsed(parsed: ParsedSheet) {
    setSheet(parsed);
    setStep("map");
  }

  function reset() {
    setSheet(null);
    setStep("source");
  }

  return (
    <div className="space-y-6">
      <StepIndicator current={step} />

      {step === "source" && <SourcePicker onParsed={handleParsed} />}

      {step === "map" && sheet && (
        <div className="space-y-6">
          <PreviewTable sheet={sheet} />
          <div className="rounded-xl border border-warning-500/20 bg-warning-50 p-4 text-sm text-warning-700 dark:border-warning-500/20 dark:bg-warning-500/10 dark:text-warning-500">
            <strong>Pass 2 coming next:</strong> column mapping and validation.
            For now this confirms the file parsed correctly.
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={reset}>
              Choose different file
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
`;

// =============================================================================
// Runner
// =============================================================================
async function main() {
  const pkg = join(ROOT, "package.json");
  if (!(await exists(pkg))) {
    console.error("package.json not found. Run from project root.");
    process.exit(1);
  }
  const pkgText = await readFile(pkg, "utf8");
  if (!pkgText.includes("papaparse") || !pkgText.includes("xlsx")) {
    console.error("Missing dependencies. Run first:");
    console.error("  npm install papaparse xlsx");
    console.error("  npm install -D @types/papaparse");
    process.exit(1);
  }

  console.log("CSV/XLSX/Sheets Importer — Pass 1\n");

  let count = 0;
  for (const [relPath, content] of Object.entries(FILES)) {
    const full = join(ROOT, relPath);
    const exists_ = await exists(full);
    console.log((exists_ ? "  ~ " : "  + ") + relPath);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, content, "utf8");
    count++;
  }

  // Add Import buttons on the three list pages
  const listPages = [
    { file: "src/app/(dashboard)/property/units/page.tsx", label: "Import units" },
    { file: "src/app/(dashboard)/property/tenants/page.tsx", label: "Import tenants" },
    { file: "src/app/(dashboard)/property/properties/page.tsx", label: "Import properties" },
  ];

  for (const { file } of listPages) {
    const full = join(ROOT, file);
    if (!(await exists(full))) continue;
    const src = await readFile(full, "utf8");

    // Insert Import link before the existing "+ New" link if not already present
    if (src.includes("/property/import")) continue;

    const updated = src.replace(
      /<Link href="(\/property\/[^"]+\/new)">\s*<Button>([^<]+)<\/Button>\s*<\/Link>/,
      (m) =>
        '<div className="flex gap-2">' +
        '<Link href="/property/import">' +
        '<Button variant="secondary">Import</Button>' +
        "</Link>" +
        m +
        "</div>"
    );

    if (updated !== src) {
      await writeFile(full, updated, "utf8");
      console.log("  ~ " + file + "  (added Import button)");
    }
  }

  console.log("\nDone — " + count + " file(s) created.\n");
  console.log("Next:");
  console.log("  npm run typecheck");
  console.log("  npm run dev");
  console.log("  Visit http://localhost:3000/property/import");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});