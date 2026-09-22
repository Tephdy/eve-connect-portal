import "server-only";

/**
 * Derive a 12-character uppercase hex control number from a contract UUID.
 * Example: "ad1ff303-abbb-47d6-86f0-17c864fb4268" -> "AD1FF303ABBB"
 *
 * Deterministic: same contract always yields the same control number.
 * If you later want a different scheme (sequential, per-property, monthly),
 * swap the body of this function and callers don't need to change.
 */
export function controlNumberFromId(contract_id: string): string {
  const hex = contract_id.replace(/-/g, "").toUpperCase();
  return hex.slice(0, 12);
}
