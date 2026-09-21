import type { TargetTable } from "./types";

export type FieldDef = {
  key: string;
  label: string;
  required: boolean;
  type: "text" | "number" | "date" | "enum";
  enumValues?: string[];
  aliases: string[];
  hint?: string;
};

export const TARGETS: {
  key: TargetTable;
  label: string;
  description: string;
  permission: string;
  fields: FieldDef[];
}[] = [
  {
    key: "properties",
    label: "Properties",
    description: "One row per property.",
    permission: "property:create",
    fields: [
      { key: "name", label: "Name", required: true, type: "text", aliases: ["property", "property name", "name"] },
      { key: "address", label: "Address", required: false, type: "text", aliases: ["address", "location", "full address"] },
      { key: "type", label: "Type", required: false, type: "enum", enumValues: ["residential", "commercial", "mixed"], aliases: ["type", "category"] },
      { key: "total_units", label: "Total units", required: false, type: "number", aliases: ["total units", "units", "unit count"] },
    ],
  },
  {
    key: "units",
    label: "Units",
    description: "One row per unit. Property must exist.",
    permission: "unit:create",
    fields: [
      { key: "property_name", label: "Property name", required: true, type: "text", aliases: ["property", "property name", "building"] },
      { key: "unit_number", label: "Unit number", required: true, type: "text", aliases: ["unit", "unit no", "unit number", "unit #", "door"] },
      { key: "floor", label: "Floor", required: false, type: "number", aliases: ["floor", "level"] },
      { key: "bedrooms", label: "Bedrooms", required: false, type: "number", aliases: ["bedrooms", "br", "bed"] },
      { key: "bathrooms", label: "Bathrooms", required: false, type: "number", aliases: ["bathrooms", "bath", "cr", "t&b"] },
      { key: "area_sqm", label: "Area (sqm)", required: false, type: "number", aliases: ["area", "sqm", "size", "area sqm", "square meters"] },
      { key: "base_rent", label: "Base rent", required: false, type: "number", aliases: ["rent", "base rent", "monthly rent", "price"] },
      { key: "status", label: "Status", required: false, type: "enum", enumValues: ["vacant", "occupied", "reserved", "maintenance", "unavailable"], aliases: ["status", "state"] },
    ],
  },
  {
    key: "tenants",
    label: "Tenants",
    description: "One row per tenant. Optionally creates a lease if unit + dates are present.",
    permission: "tenant:create",
    fields: [
      { key: "full_name", label: "Full name", required: true, type: "text", aliases: ["tenant name", "tenant", "full name", "name"] },
      { key: "email", label: "Email", required: false, type: "text", aliases: ["email", "e-mail", "email address"] },
      { key: "phone", label: "Phone", required: false, type: "text", aliases: ["phone", "mobile", "contact", "cell"] },
      { key: "messenger_name", label: "Messenger name", required: false, type: "text", aliases: ["messenger", "messenger name", "fb", "facebook"] },
      { key: "government_id", label: "Government ID", required: false, type: "text", aliases: ["id", "gov id", "government id"] },
      { key: "property_name", label: "Property name", required: false, type: "text", aliases: ["property", "property name", "building"], hint: "If present with unit, creates a lease." },
      { key: "unit_number", label: "Unit number", required: false, type: "text", aliases: ["unit", "unit no", "unit number"], hint: "Used with property name to link a lease." },
      { key: "monthly_rent", label: "Monthly rent", required: false, type: "number", aliases: ["rent", "monthly rent", "rate"] },
      { key: "move_in_date", label: "Move-in date", required: false, type: "date", aliases: ["move in", "move-in", "movein", "move in date", "start", "start date"] },
      { key: "end_date", label: "End of contract", required: false, type: "date", aliases: ["end", "end date", "end of contract", "contract end"] },
    ],
  },
  {
    key: "leases",
    label: "Leases",
    description: "One row per lease. Tenant and unit must exist.",
    permission: "lease:create",
    fields: [
      { key: "tenant_email", label: "Tenant email", required: true, type: "text", aliases: ["email", "tenant email", "e-mail"] },
      { key: "property_name", label: "Property name", required: true, type: "text", aliases: ["property", "property name", "building"] },
      { key: "unit_number", label: "Unit number", required: true, type: "text", aliases: ["unit", "unit no", "unit number"] },
      { key: "start_date", label: "Start date", required: true, type: "date", aliases: ["start", "start date", "move in", "move-in"] },
      { key: "end_date", label: "End date", required: true, type: "date", aliases: ["end", "end date", "contract end"] },
      { key: "monthly_rent", label: "Monthly rent", required: false, type: "number", aliases: ["rent", "monthly rent", "rate"] },
      { key: "deposit_amount", label: "Deposit amount", required: false, type: "number", aliases: ["deposit", "deposit amount"] },
      { key: "due_date", label: "Due date", required: false, type: "date", aliases: ["due", "due date"] },
      { key: "notice_period_days", label: "Notice period (days)", required: false, type: "number", aliases: ["notice", "notice days", "notice period"] },
    ],
  },
];

export function getTarget(key: TargetTable) {
  return TARGETS.find((t) => t.key === key);
}
