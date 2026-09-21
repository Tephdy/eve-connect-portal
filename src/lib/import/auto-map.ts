import type { ColumnMapping, TargetTable } from "./types";
import { getTarget } from "./field-defs";

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
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
