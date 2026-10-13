// @@CONTRACT_ENGINE:control-number
// @@CONTRACT_ENGINE:control-number-augmented
import "server-only";

// ---------------------------------------------------------------------------
// Legacy API — deterministic control number derived from a UUID/id string.
// Used by the print page: controlNumberFromId(contract.id).
//
// Format: EVE-<YYYY>-<6-hex>
// Example: EVE-2026-A3F91C
//
// Deterministic: same id always yields the same control number, so printed
// contracts remain verifiable across regenerations.
// ---------------------------------------------------------------------------

export function controlNumberFromId(id: string): string {
  const year = new Date().getFullYear();
  // Simple deterministic hash of the id string (FNV-1a style).
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  const hex = hash.toString(16).padStart(8, "0").slice(-6).toUpperCase();
  return `EVE-${year}-${hex}`;
}

// ---------------------------------------------------------------------------
// New API — sequence-based control number for cases where we want
// sequential ordering (e.g. per-property numbering backed by a DB counter).
// ---------------------------------------------------------------------------

export type ControlNumberInput = {
  prefix?: string | null;
  year?: number;
  sequence: number;
};

export function formatControlNumber(input: ControlNumberInput): string {
  const prefix =
    (input.prefix ?? "EVE").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) ||
    "EVE";
  const year = input.year ?? new Date().getFullYear();
  const seq = Math.max(1, Math.floor(input.sequence));
  return `${prefix}-${year}-${String(seq).padStart(5, "0")}`;
}

// ---------------------------------------------------------------------------
// Barcode helper
// ---------------------------------------------------------------------------

export function barcodeValueFor(controlNumber: string): string {
  return controlNumber.replace(/\s+/g, "").toUpperCase();
}
