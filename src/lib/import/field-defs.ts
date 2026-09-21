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
      { key: "property_name", label: "Property name", required: false, type: "text", aliases: ["property", "property name", "building"] },
      { key: "unit_number", label: "Unit number", required: false, type: "text", aliases: ["unit", "unit no", "unit number"] },
      { key: "monthly_rent", label: "Monthly rent", required: false, type: "number", aliases: ["rent", "monthly rent", "rate", "monthly rent (php)"] },
      { key: "move_in_date", label: "Move-in date", required: false, type: "date", aliases: ["move in", "move-in", "movein", "move in date", "start", "start date"] },
      { key: "end_date", label: "End of contract", required: false, type: "date", aliases: ["end", "end date", "end of contract", "contract end", "contract"] },
    ],
  },
  {
    key: "leases",
    label: "Leases",
    description: "One row per lease. Tenant matched by name or email; unit by property + number.",
    permission: "lease:create",
    fields: [
      // ---- Required ----
      { key: "property_name", label: "Property", required: true, type: "text", aliases: ["property", "property name", "building"] },
      { key: "unit_number", label: "Unit", required: true, type: "text", aliases: ["unit", "unit no", "unit number", "unit #"] },
      { key: "full_name", label: "Full name", required: true, type: "text", aliases: ["tenant name", "tenant", "full name", "name"] },

      // ---- Optional lease fields ----
      { key: "email", label: "Email", required: false, type: "text", aliases: ["email", "e-mail", "email address"] },
      { key: "address", label: "Address", required: false, type: "text", aliases: ["address", "location", "full address"], hint: "Stored on the lease record (uses unit's property if blank)" },
      { key: "term", label: "Contract", required: false, type: "enum", enumValues: ["1_month","3_months","6_months","1_year","2_years","3_years","other"], aliases: ["contract", "term", "contract term", "duration"], hint: "e.g. 1_month, 6_months, 1_year" },
      { key: "intent", label: "Intent", required: false, type: "enum", enumValues: ["new","renew","extend"], aliases: ["intent", "type", "purpose"] },
      { key: "start_date", label: "Start date", required: false, type: "date", aliases: ["start", "start date", "move in", "move-in"] },
      { key: "end_date", label: "End of contract", required: false, type: "date", aliases: ["end", "end date", "end of contract", "contract end"] },
      { key: "move_in_date", label: "Move-in date", required: false, type: "date", aliases: ["move in", "move-in", "move in date", "movein"] },
      { key: "due_date", label: "Rent due", required: false, type: "date", aliases: ["due", "due date", "rent due", "rent due date"] },
      { key: "monthly_rent", label: "Monthly rent (PHP)", required: false, type: "number", aliases: ["rent", "monthly rent", "rate", "monthly rent (php)"] },
      { key: "deposit_1", label: "1st deposit", required: false, type: "number", aliases: ["1st deposit", "first deposit", "deposit 1", "deposit1"] },
      { key: "deposit_2", label: "2nd deposit", required: false, type: "number", aliases: ["2nd deposit", "second deposit", "deposit 2", "deposit2"] },
      { key: "ad_ons", label: "Add-ons", required: false, type: "text", aliases: ["add-ons", "addons", "add ons", "extras", "inclusions"], hint: "Comma-separated: Foam, AC, Bedframe" },
      { key: "ad_ons_amount", label: "Add-ons amount", required: false, type: "number", aliases: ["add-ons amount", "addons amount", "add ons amount", "extras amount"] },
      { key: "notice_period_days", label: "Notice period", required: false, type: "number", aliases: ["notice period", "notice", "notice days", "notice period (days)"] },
    ],
  },
];

export function getTarget(key: TargetTable) {
  return TARGETS.find((t) => t.key === key);
}
