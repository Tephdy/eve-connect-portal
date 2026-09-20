import "server-only";

type RenderData = Record<string, string>;

export function renderTemplate(template: string, data: RenderData): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => data[key] ?? "");
}

export function buildLeaseData(input: {
  property_name: string;
  property_address: string | null;
  unit_number: string;
  tenant_full_name: string;
  tenant_email: string | null;
  tenant_phone: string | null;
  lease_start: string;
  lease_end: string;
  monthly_rent: number;
  deposit_amount: number;
  notice_period_days: number;
}): RenderData {
  const php = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  });
  return {
    property_name: input.property_name,
    property_address: input.property_address ?? "",
    unit_number: input.unit_number,
    tenant_full_name: input.tenant_full_name,
    tenant_email: input.tenant_email ?? "",
    tenant_phone: input.tenant_phone ?? "",
    lease_start: input.lease_start,
    lease_end: input.lease_end,
    monthly_rent: php.format(input.monthly_rent),
    deposit_amount: php.format(input.deposit_amount),
    notice_period_days: String(input.notice_period_days),
    today: new Date().toLocaleDateString("en-PH", {
      year: "numeric", month: "long", day: "numeric",
    }),
  };
}
