/**
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
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!m) return null;

  const sheetId = m[1];
  const gidMatch = url.match(/[#&?]gid=(\d+)/);
  const gid = gidMatch ? gidMatch[1] : "0";

  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
}

export function isSheetsUrl(input: string): boolean {
  return /^https?:\/\/docs\.google\.com\/spreadsheets\//.test(input.trim());
}
