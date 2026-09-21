import "server-only";
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
