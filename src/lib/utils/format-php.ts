const phpFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatPHP(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined) return "₱0.00";
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (Number.isNaN(n)) return "₱0.00";
  return phpFormatter.format(n);
}
