export type ImportSource = "csv" | "xlsx" | "sheets";

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
