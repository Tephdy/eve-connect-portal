"use server";

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
    return { ok: false, error: "Sheet \"" + input.sheet_name + "\" is empty" };
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
