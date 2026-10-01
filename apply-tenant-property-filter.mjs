// apply-tenant-property-filter.mjs
// Idempotent patch: adds a Property filter to the tenants page.
// Usage: node apply-tenant-property-filter.mjs

import { existsSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";

const F_TENANTS_DB = "src/lib/db/tenants.ts";
const F_TENANTS_PAGE = "src/app/(dashboard)/property/tenants/page.tsx";
const F_TENANTS_FILTER = "src/components/tenant/tenant-filters.tsx";

const MARKER_DB = "// ---- PROPERTY ENRICHMENT (added by apply-tenant-property-filter.mjs) ----";

const DB_APPEND = `

${MARKER_DB}

export type TenantWithProperty = Tenant & {
  property_id: string | null;
  property_name: string | null;
  unit_number: string | null;
};

export async function listTenantsWithProperty(): Promise<TenantWithProperty[]> {
  const supabase = await createClient();

  const { data: tenants, error } = await supabase
    .from("tenant")
    .select(TENANT_SELECT)
    .order("full_name", { ascending: true });
  if (error) throw new Error(error.message);
  if (!tenants || tenants.length === 0) return [];

  const tenantIds = tenants.map((t: any) => t.id);

  const { data: leases } = await supabase
    .from("lease")
    .select("tenant_id, unit_id, status")
    .in("tenant_id", tenantIds)
    .eq("status", "active");

  const leaseByTenant = new Map<string, string>();
  for (const l of leases ?? []) {
    if (!leaseByTenant.has((l as any).tenant_id)) {
      leaseByTenant.set((l as any).tenant_id, (l as any).unit_id);
    }
  }

  const unitIds = Array.from(new Set(Array.from(leaseByTenant.values())));
  const { data: units } =
    unitIds.length > 0
      ? await supabase
          .from("unit")
          .select("id, unit_number, property_id")
          .in("id", unitIds)
      : { data: [] as any[] };
  const unitMap = new Map((units ?? []).map((u: any) => [u.id, u]));

  const propertyIds = Array.from(
    new Set((units ?? []).map((u: any) => u.property_id).filter(Boolean))
  );
  const { data: props } =
    propertyIds.length > 0
      ? await supabase
          .from("property")
          .select("id, name")
          .in("id", propertyIds)
      : { data: [] as any[] };
  const propMap = new Map((props ?? []).map((p: any) => [p.id, p.name]));

  return tenants.map((t: any) => {
    const unitId = leaseByTenant.get(t.id);
    const u: any = unitId ? unitMap.get(unitId) : null;
    return {
      ...t,
      property_id: u?.property_id ?? null,
      property_name: u?.property_id ? propMap.get(u.property_id) ?? null : null,
      unit_number: u?.unit_number ?? null,
    };
  }) as TenantWithProperty[];
}
`;

const NL = (s) => (s.includes("\r\n") ? "\r\n" : "\n");

function norm(s) { return s.replace(/\r\n/g, "\n"); }
function denorm(s, nl) { return nl === "\r\n" ? s.replace(/\n/g, "\r\n") : s; }

function patchFile(path, mutate, label) {
  if (!existsSync(path)) {
    console.error("MISSING " + path);
    process.exit(1);
  }
  const original = readFileSync(path, "utf8");
  const nl = NL(original);
  const src = norm(original);
  const result = mutate(src, path);
  if (result === null) {
    console.log("SKIP  " + path);
    return;
  }
  if (result === src) {
    console.log("NO CHANGE  " + path);
    return;
  }
  copyFileSync(path, path + ".bak");
  writeFileSync(path, denorm(result, nl), "utf8");
  console.log("PATCH " + path + "  (" + label + ")");
}

// ---------------------------------------------------------------------
// 1. Append DAL function
// ---------------------------------------------------------------------
patchFile(F_TENANTS_DB, (src) => {
  if (src.includes(MARKER_DB)) return null;
  return src + DB_APPEND;
}, "added listTenantsWithProperty");

// ---------------------------------------------------------------------
// 2. Patch tenants page
// ---------------------------------------------------------------------
patchFile(F_TENANTS_PAGE, (src) => {
  if (src.includes("listTenantsWithProperty")) return null;

  // 2a. Import swap
  src = src.replace(
    'import { listTenants } from "@/lib/db/tenants";',
    'import { listTenantsWithProperty } from "@/lib/db/tenants";'
  );

  // 2b. searchParams type
  src = src.replace(
    /searchParams: Promise<\{\s*q\?: string;\s*status\?: string;\s*messenger\?: string;\s*email\?: string;\s*\}>;/,
    `searchParams: Promise<{
    q?: string;
    status?: string;
    messenger?: string;
    email?: string;
    property?: string;
  }>;`
  );

  // 2c. Fetch + filter block
  const oldBlock = `  const allTenants = await listTenants();`;
  const newFetchBlock = `  const [allTenants, propertiesRaw] = await Promise.all([
    listTenantsWithProperty(),
    (await import("@/lib/db/properties")).listProperties(),
  ]);
  const properties = propertiesRaw.map((p) => ({ id: p.id, name: p.name }));`;
  src = src.replace(oldBlock, newFetchBlock);

  // 2d. Add propertyId read
  src = src.replace(
    /const status = sp\.status \?\? "";/,
    `const status = sp.status ?? "";
  const propertyId = sp.property ?? "";`
  );

  // 2e. Add property check inside filter
  src = src.replace(
    /if \(status && t\.status !== status\) return false;/,
    `if (status && t.status !== status) return false;
    if (propertyId && t.property_id !== propertyId) return false;`
  );

  // 2f. hasFilters
  src = src.replace(
    /const hasFilters = !!\(q \|\| status \|\| hasMessenger \|\| hasEmail\);/,
    `const hasFilters = !!(q || status || propertyId || hasMessenger || hasEmail);`
  );

  // 2g. Pass properties to TenantFilters
  src = src.replace("<TenantFilters />", "<TenantFilters properties={properties} />");

  return src;
}, "added property filter to page");

// ---------------------------------------------------------------------
// 3. Patch filter component
// ---------------------------------------------------------------------
patchFile(F_TENANTS_FILTER, (src) => {
  if (src.includes("All properties")) return null;

  // 3a. Signature
  src = src.replace(
    "export function TenantFilters() {",
    `export function TenantFilters({
  properties,
}: {
  properties: { id: string; name: string }[];
}) {`
  );

  // 3b. Read param
  src = src.replace(
    /const status = searchParams\.get\("status"\) \?\? "";/,
    `const status = searchParams.get("status") ?? "";
  const property = searchParams.get("property") ?? "";`
  );

  // 3c. hasFilters
  src = src.replace(
    /const hasFilters = !!\(q \|\| status \|\| hasMessenger \|\| hasEmail\);/,
    `const hasFilters = !!(q || status || property || hasMessenger || hasEmail);`
  );

  // 3d. Grid to 4 columns
  src = src.replace(
    'className="grid grid-cols-1 gap-3 md:grid-cols-3"',
    'className="grid grid-cols-1 gap-3 md:grid-cols-4"'
  );

  // 3e. Insert property select after status select
  const statusSelectEnd = /(<\/select>)/;
  const insertAfterStatus = src.indexOf("</select>");
  if (insertAfterStatus === -1) {
    console.error("ABORT: could not find </select> in " + F_TENANTS_FILTER);
    process.exit(1);
  }
  const propertySelect = `
        {/* Property */}
        <select
          value={property}
          onChange={(e) => updateParam("property", e.target.value || null)}
          className="h-9 rounded-md border border-ink-200 bg-surface px-3 text-sm text-ink-800 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-white/[0.06]"
        >
          <option value="">All properties</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>`;
  src = src.slice(0, insertAfterStatus + "</select>".length) +
        propertySelect +
        src.slice(insertAfterStatus + "</select>".length);

  return src;
}, "added property dropdown to filters");

console.log("");
console.log("Done.");
console.log("Next: npm run typecheck");
console.log("Rollback: every changed file has a .bak next to it.");