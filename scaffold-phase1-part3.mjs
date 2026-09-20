#!/usr/bin/env node
/**
 * Phase 1 Part 3 - Units, Tenants, Leases
 * Usage: node scaffold-phase1-part3.mjs
 * Run from project root.
 */

import { mkdir, writeFile, access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { join, dirname } from "node:path";

const ROOT = process.cwd();
const FILES = {};

async function exists(p) {
  try { await access(p, constants.F_OK); return true; } catch { return false; }
}

// =============================================================================
// UNITS
// =============================================================================

FILES["src/lib/schemas/unit.ts"] =
`import { z } from "zod";

export const unitStatuses = ["vacant","occupied","reserved","maintenance","unavailable"] as const;

export const unitCreateSchema = z.object({
  property_id: z.string().uuid("Property is required"),
  unit_number: z.string().min(1, "Unit number is required").max(50),
  floor: z.coerce.number().int().optional(),
  bedrooms: z.coerce.number().int().min(0).optional(),
  bathrooms: z.coerce.number().min(0).optional(),
  area_sqm: z.coerce.number().min(0).optional(),
  base_rent: z.coerce.number().min(0).optional(),
  status: z.enum(unitStatuses).default("vacant"),
});

export const unitUpdateSchema = unitCreateSchema.partial();

export type UnitCreateInput = z.infer<typeof unitCreateSchema>;
export type UnitUpdateInput = z.infer<typeof unitUpdateSchema>;
`;

FILES["src/lib/db/units.ts"] =
`import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { UnitCreateInput, UnitUpdateInput } from "@/lib/schemas/unit";

export type Unit = {
  id: string;
  property_id: string;
  unit_number: string;
  floor: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  area_sqm: number | null;
  base_rent: number | null;
  status: "vacant" | "occupied" | "reserved" | "maintenance" | "unavailable";
  created_at: string;
  property_name?: string;
};

export async function listUnits(): Promise<Unit[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("unit")
    .select("id, property_id, unit_number, floor, bedrooms, bathrooms, area_sqm, base_rent, status, created_at")
    .order("unit_number", { ascending: true });
  if (error) throw new Error(error.message);

  const units = (data ?? []) as Unit[];
  const propIds = Array.from(new Set(units.map((u) => u.property_id)));
  if (propIds.length > 0) {
    const { data: props } = await supabase
      .from("property")
      .select("id, name")
      .in("id", propIds);
    const map = new Map((props ?? []).map((p) => [p.id, p.name]));
    units.forEach((u) => { u.property_name = map.get(u.property_id); });
  }
  return units;
}

export async function getUnit(id: string): Promise<Unit | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("unit")
    .select("id, property_id, unit_number, floor, bedrooms, bathrooms, area_sqm, base_rent, status, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Unit) ?? null;
}

export async function createUnit(input: UnitCreateInput): Promise<Unit> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("unit")
    .insert({
      property_id: input.property_id,
      unit_number: input.unit_number,
      floor: input.floor ?? null,
      bedrooms: input.bedrooms ?? null,
      bathrooms: input.bathrooms ?? null,
      area_sqm: input.area_sqm ?? null,
      base_rent: input.base_rent ?? null,
      status: input.status,
    })
    .select("id, property_id, unit_number, floor, bedrooms, bathrooms, area_sqm, base_rent, status, created_at")
    .single();
  if (error) throw new Error(error.message);
  return data as Unit;
}

export async function updateUnit(id: string, input: UnitUpdateInput): Promise<Unit> {
  const supabase = await createClient();
  const patch: Record<string, unknown> = {};
  if (input.property_id !== undefined) patch.property_id = input.property_id;
  if (input.unit_number !== undefined) patch.unit_number = input.unit_number;
  if (input.floor !== undefined) patch.floor = input.floor;
  if (input.bedrooms !== undefined) patch.bedrooms = input.bedrooms;
  if (input.bathrooms !== undefined) patch.bathrooms = input.bathrooms;
  if (input.area_sqm !== undefined) patch.area_sqm = input.area_sqm;
  if (input.base_rent !== undefined) patch.base_rent = input.base_rent;
  if (input.status !== undefined) patch.status = input.status;
  const { data, error } = await supabase
    .from("unit").update(patch).eq("id", id)
    .select("id, property_id, unit_number, floor, bedrooms, bathrooms, area_sqm, base_rent, status, created_at")
    .single();
  if (error) throw new Error(error.message);
  return data as Unit;
}

export async function archiveUnit(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("unit").update({ status: "unavailable" }).eq("id", id);
  if (error) throw new Error(error.message);
}
`;

FILES["src/app/(dashboard)/property/units/page.tsx"] =
`import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/guard";
import { listUnits } from "@/lib/db/units";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { UnitTable } from "@/components/unit/unit-table";

export default async function UnitsPage() {
  await requirePagePermission("unit:read");
  const units = await listUnits();
  return (
    <div>
      <PageHeader
        title="Units"
        description="All units across properties."
        action={
          <Link href="/property/units/new">
            <Button>+ New Unit</Button>
          </Link>
        }
      />
      {units.length === 0 ? (
        <EmptyState
          title="No units yet"
          description="Create your first unit to get started."
          action={
            <Link href="/property/units/new">
              <Button>+ New Unit</Button>
            </Link>
          }
        />
      ) : (
        <UnitTable units={units} />
      )}
    </div>
  );
}
`;

FILES["src/app/(dashboard)/property/units/actions.ts"] =
`"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertPermission } from "@/lib/auth/guard";
import { getSession } from "@/lib/auth/get-session";
import { createUnit, updateUnit } from "@/lib/db/units";
import { logAudit } from "@/lib/audit/log";
import { unitCreateSchema, unitUpdateSchema } from "@/lib/schemas/unit";
import { parseForm } from "@/lib/forms/parse";
import type { ActionResult } from "@/lib/actions/result";

export async function createUnitAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await assertPermission("unit:create");
  const parsed = parseForm(unitCreateSchema, formData);
  if (!parsed.ok) return { ok: false, error: parsed.error, fieldErrors: parsed.fieldErrors };
  const session = await getSession();
  const unit = await createUnit(parsed.data);
  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "unit",
    entity_id: unit.id,
    action: "create",
    after: unit,
  });
  revalidatePath("/property/units");
  redirect("/property/units/" + unit.id);
}

export async function updateUnitAction(
  id: string,
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await assertPermission("unit:update");
  const parsed = parseForm(unitUpdateSchema, formData);
  if (!parsed.ok) return { ok: false, error: parsed.error, fieldErrors: parsed.fieldErrors };
  const session = await getSession();
  const updated = await updateUnit(id, parsed.data);
  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "unit",
    entity_id: id,
    action: "update",
    after: updated,
  });
  revalidatePath("/property/units");
  revalidatePath("/property/units/" + id);
  return { ok: true, data: undefined };
}
`;

FILES["src/app/(dashboard)/property/units/new/page.tsx"] =
`import { requirePagePermission } from "@/lib/auth/guard";
import { PageHeader } from "@/components/layout/page-header";
import { UnitForm } from "@/components/unit/unit-form";
import { listProperties } from "@/lib/db/properties";

export default async function NewUnitPage() {
  await requirePagePermission("unit:create");
  const properties = await listProperties();
  return (
    <div>
      <PageHeader title="New Unit" description="Add a unit to a property." />
      <UnitForm mode="create" properties={properties} />
    </div>
  );
}
`;

FILES["src/app/(dashboard)/property/units/[id]/page.tsx"] =
`import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/guard";
import { getUnit } from "@/lib/db/units";
import { listProperties } from "@/lib/db/properties";
import { PageHeader } from "@/components/layout/page-header";
import { UnitForm } from "@/components/unit/unit-form";

export default async function UnitDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("unit:read");
  const { id } = await params;
  const unit = await getUnit(id);
  if (!unit) notFound();
  const properties = await listProperties();

  return (
    <div>
      <PageHeader
        title={"Unit " + unit.unit_number}
        description={unit.property_name ?? ""}
      />
      <UnitForm mode="edit" unit={unit} properties={properties} />
    </div>
  );
}
`;

FILES["src/components/unit/unit-form.tsx"] =
`"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { createUnitAction, updateUnitAction } from "@/app/(dashboard)/property/units/actions";
import type { ActionResult } from "@/lib/actions/result";
import type { Unit } from "@/lib/db/units";
import type { Property } from "@/lib/db/properties";

const STATUS_OPTIONS = [
  { value: "vacant",       label: "Vacant" },
  { value: "occupied",     label: "Occupied" },
  { value: "reserved",     label: "Reserved" },
  { value: "maintenance",  label: "Maintenance" },
  { value: "unavailable",  label: "Unavailable" },
];

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" loading={pending}>{label}</Button>;
}

export function UnitForm({
  mode,
  unit,
  properties,
}: {
  mode: "create" | "edit";
  unit?: Unit;
  properties: Property[];
}) {
  const router = useRouter();
  const toast = useToast();
  const action = mode === "create" ? createUnitAction : updateUnitAction.bind(null, unit!.id);
  const [state, formAction] = useActionState<ActionResult | null, FormData>(action, null);

  useEffect(() => {
    if (state?.ok) {
      toast.push(mode === "create" ? "Unit created" : "Unit updated", "success");
      if (mode === "edit") router.refresh();
    } else if (state && !state.ok) {
      toast.push(state.error, "error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const fieldError = (k: string) => (state && !state.ok ? state.fieldErrors?.[k] : undefined);

  const propOptions = properties.map((p) => ({ value: p.id, label: p.name }));

  return (
    <Card className="max-w-2xl">
      <CardBody>
        <form action={formAction} className="space-y-4">
          <Select
            name="property_id"
            label="Property"
            options={propOptions}
            placeholder="Select a property"
            defaultValue={unit?.property_id ?? ""}
            error={fieldError("property_id")}
            required
          />
          <Input name="unit_number" label="Unit number" defaultValue={unit?.unit_number ?? ""} error={fieldError("unit_number")} required />
          <div className="grid grid-cols-2 gap-4">
            <Input name="floor" label="Floor" type="number" defaultValue={unit?.floor ?? ""} error={fieldError("floor")} />
            <Input name="bedrooms" label="Bedrooms" type="number" min={0} defaultValue={unit?.bedrooms ?? ""} error={fieldError("bedrooms")} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input name="bathrooms" label="Bathrooms" type="number" step="0.5" min={0} defaultValue={unit?.bathrooms ?? ""} error={fieldError("bathrooms")} />
            <Input name="area_sqm" label="Area (sqm)" type="number" step="0.01" min={0} defaultValue={unit?.area_sqm ?? ""} error={fieldError("area_sqm")} />
          </div>
          <Input name="base_rent" label="Base rent (PHP)" type="number" step="0.01" min={0} defaultValue={unit?.base_rent ?? ""} error={fieldError("base_rent")} />
          <Select name="status" label="Status" options={STATUS_OPTIONS} defaultValue={unit?.status ?? "vacant"} error={fieldError("status")} />
          <div className="flex items-center gap-3 pt-2">
            <SubmitButton label={mode === "create" ? "Create Unit" : "Save Changes"} />
            <Button type="button" variant="secondary" onClick={() => router.push("/property/units")}>
              Cancel
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
`;

FILES["src/components/unit/unit-table.tsx"] =
`import Link from "next/link";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatPHP } from "@/lib/utils/format-php";
import type { Unit } from "@/lib/db/units";

const STATUS_TONE: Record<string, "green" | "blue" | "yellow" | "red" | "gray"> = {
  vacant: "green", occupied: "blue", reserved: "yellow",
  maintenance: "red", unavailable: "gray",
};

export function UnitTable({ units }: { units: Unit[] }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <Table>
        <THead>
          <TR>
            <TH>Unit</TH><TH>Property</TH><TH>Layout</TH>
            <TH className="text-right">Rent</TH><TH>Status</TH>
            <TH className="text-right">Actions</TH>
          </TR>
        </THead>
        <TBody>
          {units.map((u) => (
            <TR key={u.id}>
              <TD className="font-medium">
                <Link href={"/property/units/" + u.id} className="text-brand-600 hover:underline">
                  {u.unit_number}
                </Link>
              </TD>
              <TD className="text-gray-600">{u.property_name ?? "—"}</TD>
              <TD className="text-gray-600">
                {u.bedrooms != null ? u.bedrooms + "BR" : "—"} · {u.area_sqm != null ? u.area_sqm + " sqm" : "—"}
              </TD>
              <TD className="text-right">{u.base_rent != null ? formatPHP(u.base_rent) : "—"}</TD>
              <TD><Badge tone={STATUS_TONE[u.status] ?? "gray"}>{u.status}</Badge></TD>
              <TD className="text-right">
                <Link href={"/property/units/" + u.id} className="text-brand-600 hover:underline text-sm">
                  Edit
                </Link>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
`;

// =============================================================================
// TENANTS
// =============================================================================

FILES["src/lib/schemas/tenant.ts"] =
`import { z } from "zod";

export const tenantStatuses = ["prospect","active","former","blacklisted"] as const;

export const tenantCreateSchema = z.object({
  full_name: z.string().min(1, "Full name is required").max(200),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().max(50).optional().or(z.literal("")),
  government_id: z.string().max(100).optional().or(z.literal("")),
  status: z.enum(tenantStatuses).default("prospect"),
});

export const tenantUpdateSchema = tenantCreateSchema.partial();

export type TenantCreateInput = z.infer<typeof tenantCreateSchema>;
export type TenantUpdateInput = z.infer<typeof tenantUpdateSchema>;
`;

FILES["src/lib/db/tenants.ts"] =
`import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { TenantCreateInput, TenantUpdateInput } from "@/lib/schemas/tenant";

export type Tenant = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  government_id: string | null;
  status: "prospect" | "active" | "former" | "blacklisted";
  created_at: string;
};

export async function listTenants(): Promise<Tenant[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tenant")
    .select("id, full_name, email, phone, government_id, status, created_at")
    .order("full_name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Tenant[];
}

export async function getTenant(id: string): Promise<Tenant | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tenant")
    .select("id, full_name, email, phone, government_id, status, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Tenant) ?? null;
}

export async function createTenant(input: TenantCreateInput): Promise<Tenant> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tenant")
    .insert({
      full_name: input.full_name,
      email: input.email || null,
      phone: input.phone || null,
      government_id: input.government_id || null,
      status: input.status,
    })
    .select("id, full_name, email, phone, government_id, status, created_at")
    .single();
  if (error) throw new Error(error.message);
  return data as Tenant;
}

export async function updateTenant(id: string, input: TenantUpdateInput): Promise<Tenant> {
  const supabase = await createClient();
  const patch: Record<string, unknown> = {};
  if (input.full_name !== undefined) patch.full_name = input.full_name;
  if (input.email !== undefined) patch.email = input.email || null;
  if (input.phone !== undefined) patch.phone = input.phone || null;
  if (input.government_id !== undefined) patch.government_id = input.government_id || null;
  if (input.status !== undefined) patch.status = input.status;
  const { data, error } = await supabase
    .from("tenant").update(patch).eq("id", id)
    .select("id, full_name, email, phone, government_id, status, created_at")
    .single();
  if (error) throw new Error(error.message);
  return data as Tenant;
}
`;

FILES["src/app/(dashboard)/property/tenants/page.tsx"] =
`import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/guard";
import { listTenants } from "@/lib/db/tenants";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { TenantTable } from "@/components/tenant/tenant-table";

export default async function TenantsPage() {
  await requirePagePermission("tenant:read");
  const tenants = await listTenants();
  return (
    <div>
      <PageHeader
        title="Tenants"
        description="All tenants and prospects."
        action={<Link href="/property/tenants/new"><Button>+ New Tenant</Button></Link>}
      />
      {tenants.length === 0 ? (
        <EmptyState
          title="No tenants yet"
          description="Add your first tenant to get started."
          action={<Link href="/property/tenants/new"><Button>+ New Tenant</Button></Link>}
        />
      ) : (
        <TenantTable tenants={tenants} />
      )}
    </div>
  );
}
`;

FILES["src/app/(dashboard)/property/tenants/actions.ts"] =
`"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertPermission } from "@/lib/auth/guard";
import { getSession } from "@/lib/auth/get-session";
import { createTenant, updateTenant } from "@/lib/db/tenants";
import { logAudit } from "@/lib/audit/log";
import { tenantCreateSchema, tenantUpdateSchema } from "@/lib/schemas/tenant";
import { parseForm } from "@/lib/forms/parse";
import type { ActionResult } from "@/lib/actions/result";

export async function createTenantAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await assertPermission("tenant:create");
  const parsed = parseForm(tenantCreateSchema, formData);
  if (!parsed.ok) return { ok: false, error: parsed.error, fieldErrors: parsed.fieldErrors };
  const session = await getSession();
  const tenant = await createTenant(parsed.data);
  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "tenant",
    entity_id: tenant.id,
    action: "create",
    after: tenant,
  });
  revalidatePath("/property/tenants");
  redirect("/property/tenants/" + tenant.id);
}

export async function updateTenantAction(
  id: string,
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await assertPermission("tenant:update");
  const parsed = parseForm(tenantUpdateSchema, formData);
  if (!parsed.ok) return { ok: false, error: parsed.error, fieldErrors: parsed.fieldErrors };
  const session = await getSession();
  const updated = await updateTenant(id, parsed.data);
  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "tenant",
    entity_id: id,
    action: "update",
    after: updated,
  });
  revalidatePath("/property/tenants");
  revalidatePath("/property/tenants/" + id);
  return { ok: true, data: undefined };
}
`;

FILES["src/app/(dashboard)/property/tenants/new/page.tsx"] =
`import { requirePagePermission } from "@/lib/auth/guard";
import { PageHeader } from "@/components/layout/page-header";
import { TenantForm } from "@/components/tenant/tenant-form";

export default async function NewTenantPage() {
  await requirePagePermission("tenant:create");
  return (
    <div>
      <PageHeader title="New Tenant" description="Add a tenant or prospect." />
      <TenantForm mode="create" />
    </div>
  );
}
`;

FILES["src/app/(dashboard)/property/tenants/[id]/page.tsx"] =
`import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/guard";
import { getTenant } from "@/lib/db/tenants";
import { PageHeader } from "@/components/layout/page-header";
import { TenantForm } from "@/components/tenant/tenant-form";

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("tenant:read");
  const { id } = await params;
  const tenant = await getTenant(id);
  if (!tenant) notFound();
  return (
    <div>
      <PageHeader title={tenant.full_name} description={tenant.email ?? ""} />
      <TenantForm mode="edit" tenant={tenant} />
    </div>
  );
}
`;

FILES["src/components/tenant/tenant-form.tsx"] =
`"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { createTenantAction, updateTenantAction } from "@/app/(dashboard)/property/tenants/actions";
import type { ActionResult } from "@/lib/actions/result";
import type { Tenant } from "@/lib/db/tenants";

const STATUS_OPTIONS = [
  { value: "prospect",    label: "Prospect" },
  { value: "active",      label: "Active" },
  { value: "former",      label: "Former" },
  { value: "blacklisted", label: "Blacklisted" },
];

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" loading={pending}>{label}</Button>;
}

export function TenantForm({
  mode,
  tenant,
}: {
  mode: "create" | "edit";
  tenant?: Tenant;
}) {
  const router = useRouter();
  const toast = useToast();
  const action = mode === "create" ? createTenantAction : updateTenantAction.bind(null, tenant!.id);
  const [state, formAction] = useActionState<ActionResult | null, FormData>(action, null);

  useEffect(() => {
    if (state?.ok) {
      toast.push(mode === "create" ? "Tenant created" : "Tenant updated", "success");
      if (mode === "edit") router.refresh();
    } else if (state && !state.ok) {
      toast.push(state.error, "error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const fieldError = (k: string) => (state && !state.ok ? state.fieldErrors?.[k] : undefined);

  return (
    <Card className="max-w-2xl">
      <CardBody>
        <form action={formAction} className="space-y-4">
          <Input name="full_name" label="Full name" defaultValue={tenant?.full_name ?? ""} error={fieldError("full_name")} required />
          <Input name="email" label="Email" type="email" defaultValue={tenant?.email ?? ""} error={fieldError("email")} />
          <Input name="phone" label="Phone" defaultValue={tenant?.phone ?? ""} error={fieldError("phone")} />
          <Input name="government_id" label="Government ID" defaultValue={tenant?.government_id ?? ""} error={fieldError("government_id")} hint="Stored securely; used for contracts." />
          <Select name="status" label="Status" options={STATUS_OPTIONS} defaultValue={tenant?.status ?? "prospect"} error={fieldError("status")} />
          <div className="flex items-center gap-3 pt-2">
            <SubmitButton label={mode === "create" ? "Create Tenant" : "Save Changes"} />
            <Button type="button" variant="secondary" onClick={() => router.push("/property/tenants")}>
              Cancel
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
`;

FILES["src/components/tenant/tenant-table.tsx"] =
`import Link from "next/link";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { Tenant } from "@/lib/db/tenants";

const STATUS_TONE: Record<string, "green" | "blue" | "gray" | "red"> = {
  prospect: "blue", active: "green", former: "gray", blacklisted: "red",
};

export function TenantTable({ tenants }: { tenants: Tenant[] }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <Table>
        <THead>
          <TR>
            <TH>Name</TH><TH>Email</TH><TH>Phone</TH><TH>Status</TH>
            <TH className="text-right">Actions</TH>
          </TR>
        </THead>
        <TBody>
          {tenants.map((t) => (
            <TR key={t.id}>
              <TD className="font-medium">
                <Link href={"/property/tenants/" + t.id} className="text-brand-600 hover:underline">
                  {t.full_name}
                </Link>
              </TD>
              <TD className="text-gray-600">{t.email ?? "—"}</TD>
              <TD className="text-gray-600">{t.phone ?? "—"}</TD>
              <TD><Badge tone={STATUS_TONE[t.status] ?? "gray"}>{t.status}</Badge></TD>
              <TD className="text-right">
                <Link href={"/property/tenants/" + t.id} className="text-brand-600 hover:underline text-sm">
                  Edit
                </Link>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
`;

// =============================================================================
// LEASES
// =============================================================================

FILES["src/lib/schemas/lease.ts"] =
`import { z } from "zod";

export const leaseStatuses = ["draft","active","expiring","ended","terminated"] as const;

export const leaseCreateSchema = z.object({
  unit_id: z.string().uuid("Unit is required"),
  tenant_id: z.string().uuid("Tenant is required"),
  start_date: z.string().min(1, "Start date is required"),
  end_date: z.string().min(1, "End date is required"),
  monthly_rent: z.coerce.number().min(0),
  deposit_amount: z.coerce.number().min(0).default(0),
  notice_period_days: z.coerce.number().int().min(0).default(30),
  status: z.enum(leaseStatuses).default("draft"),
}).refine((d) => new Date(d.end_date) > new Date(d.start_date), {
  message: "End date must be after start date",
  path: ["end_date"],
});

export const leaseUpdateSchema = leaseCreateSchema.innerType().partial();

export type LeaseCreateInput = z.infer<typeof leaseCreateSchema>;
export type LeaseUpdateInput = z.infer<typeof leaseUpdateSchema>;
`;

FILES["src/lib/db/leases.ts"] =
`import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { LeaseCreateInput, LeaseUpdateInput } from "@/lib/schemas/lease";

export type Lease = {
  id: string;
  unit_id: string;
  tenant_id: string;
  start_date: string;
  end_date: string;
  monthly_rent: number;
  deposit_amount: number;
  notice_period_days: number;
  status: "draft" | "active" | "expiring" | "ended" | "terminated";
  created_at: string;
  unit_number?: string;
  tenant_name?: string;
};

async function enrich(leases: Lease[]): Promise<Lease[]> {
  if (leases.length === 0) return leases;
  const supabase = await createClient();
  const unitIds = Array.from(new Set(leases.map((l) => l.unit_id)));
  const tenantIds = Array.from(new Set(leases.map((l) => l.tenant_id)));

  const [{ data: units }, { data: tenants }] = await Promise.all([
    supabase.from("unit").select("id, unit_number").in("id", unitIds),
    supabase.from("tenant").select("id, full_name").in("id", tenantIds),
  ]);

  const uMap = new Map((units ?? []).map((u) => [u.id, u.unit_number]));
  const tMap = new Map((tenants ?? []).map((t) => [t.id, t.full_name]));
  leases.forEach((l) => {
    l.unit_number = uMap.get(l.unit_id);
    l.tenant_name = tMap.get(l.tenant_id);
  });
  return leases;
}

export async function listLeases(): Promise<Lease[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lease")
    .select("id, unit_id, tenant_id, start_date, end_date, monthly_rent, deposit_amount, notice_period_days, status, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return enrich((data ?? []) as Lease[]);
}

export async function getLease(id: string): Promise<Lease | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lease")
    .select("id, unit_id, tenant_id, start_date, end_date, monthly_rent, deposit_amount, notice_period_days, status, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const [enriched] = await enrich([data as Lease]);
  return enriched;
}

export async function createLease(input: LeaseCreateInput): Promise<Lease> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lease")
    .insert({
      unit_id: input.unit_id,
      tenant_id: input.tenant_id,
      start_date: input.start_date,
      end_date: input.end_date,
      monthly_rent: input.monthly_rent,
      deposit_amount: input.deposit_amount,
      notice_period_days: input.notice_period_days,
      status: input.status,
    })
    .select("id, unit_id, tenant_id, start_date, end_date, monthly_rent, deposit_amount, notice_period_days, status, created_at")
    .single();
  if (error) throw new Error(error.message);
  return data as Lease;
}

export async function updateLease(id: string, input: LeaseUpdateInput): Promise<Lease> {
  const supabase = await createClient();
  const patch: Record<string, unknown> = {};
  const fields = ["unit_id","tenant_id","start_date","end_date","monthly_rent","deposit_amount","notice_period_days","status"] as const;
  for (const f of fields) {
    if (input[f] !== undefined) patch[f] = input[f];
  }
  const { data, error } = await supabase
    .from("lease").update(patch).eq("id", id)
    .select("id, unit_id, tenant_id, start_date, end_date, monthly_rent, deposit_amount, notice_period_days, status, created_at")
    .single();
  if (error) throw new Error(error.message);
  return data as Lease;
}

export async function terminateLease(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("lease").update({ status: "terminated" }).eq("id", id);
  if (error) throw new Error(error.message);
}
`;

FILES["src/app/(dashboard)/property/leases/page.tsx"] =
`import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/guard";
import { listLeases } from "@/lib/db/leases";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { LeaseTable } from "@/components/lease/lease-table";

export default async function LeasesPage() {
  await requirePagePermission("lease:read");
  const leases = await listLeases();
  return (
    <div>
      <PageHeader
        title="Leases"
        description="All lease agreements."
        action={<Link href="/property/leases/new"><Button>+ New Lease</Button></Link>}
      />
      {leases.length === 0 ? (
        <EmptyState
          title="No leases yet"
          description="Create your first lease to get started."
          action={<Link href="/property/leases/new"><Button>+ New Lease</Button></Link>}
        />
      ) : (
        <LeaseTable leases={leases} />
      )}
    </div>
  );
}
`;

FILES["src/app/(dashboard)/property/leases/actions.ts"] =
`"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertPermission } from "@/lib/auth/guard";
import { getSession } from "@/lib/auth/get-session";
import { createLease, updateLease, terminateLease } from "@/lib/db/leases";
import { logAudit } from "@/lib/audit/log";
import { leaseCreateSchema, leaseUpdateSchema } from "@/lib/schemas/lease";
import { parseForm } from "@/lib/forms/parse";
import type { ActionResult } from "@/lib/actions/result";

export async function createLeaseAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await assertPermission("lease:create");
  const parsed = parseForm(leaseCreateSchema, formData);
  if (!parsed.ok) return { ok: false, error: parsed.error, fieldErrors: parsed.fieldErrors };
  const session = await getSession();
  const lease = await createLease(parsed.data);
  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "lease",
    entity_id: lease.id,
    action: "create",
    after: lease,
  });
  revalidatePath("/property/leases");
  redirect("/property/leases/" + lease.id);
}

export async function updateLeaseAction(
  id: string,
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await assertPermission("lease:update");
  const parsed = parseForm(leaseUpdateSchema, formData);
  if (!parsed.ok) return { ok: false, error: parsed.error, fieldErrors: parsed.fieldErrors };
  const session = await getSession();
  const updated = await updateLease(id, parsed.data);
  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "lease",
    entity_id: id,
    action: "update",
    after: updated,
  });
  revalidatePath("/property/leases");
  revalidatePath("/property/leases/" + id);
  return { ok: true, data: undefined };
}

export async function terminateLeaseAction(id: string): Promise<void> {
  await assertPermission("lease:terminate");
  const session = await getSession();
  await terminateLease(id);
  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "lease",
    entity_id: id,
    action: "archive",
    reason: "terminated",
  });
  revalidatePath("/property/leases");
  redirect("/property/leases");
}
`;

FILES["src/app/(dashboard)/property/leases/new/page.tsx"] =
`import { requirePagePermission } from "@/lib/auth/guard";
import { listUnits } from "@/lib/db/units";
import { listTenants } from "@/lib/db/tenants";
import { PageHeader } from "@/components/layout/page-header";
import { LeaseForm } from "@/components/lease/lease-form";

export default async function NewLeasePage() {
  await requirePagePermission("lease:create");
  const [units, tenants] = await Promise.all([listUnits(), listTenants()]);
  return (
    <div>
      <PageHeader title="New Lease" description="Create a lease agreement." />
      <LeaseForm mode="create" units={units} tenants={tenants} />
    </div>
  );
}
`;

FILES["src/app/(dashboard)/property/leases/[id]/page.tsx"] =
`import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/guard";
import { getLease } from "@/lib/db/leases";
import { listUnits } from "@/lib/db/units";
import { listTenants } from "@/lib/db/tenants";
import { PageHeader } from "@/components/layout/page-header";
import { LeaseForm } from "@/components/lease/lease-form";
import { TerminateLeaseButton } from "@/components/lease/terminate-lease-button";

export default async function LeaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("lease:read");
  const { id } = await params;
  const lease = await getLease(id);
  if (!lease) notFound();

  const [units, tenants] = await Promise.all([listUnits(), listTenants()]);
  return (
    <div>
      <PageHeader
        title={"Lease for Unit " + (lease.unit_number ?? "")}
        description={lease.tenant_name ?? ""}
        action={lease.status !== "terminated" ? <TerminateLeaseButton id={lease.id} /> : undefined}
      />
      <LeaseForm mode="edit" lease={lease} units={units} tenants={tenants} />
    </div>
  );
}
`;

FILES["src/components/lease/lease-form.tsx"] =
`"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { createLeaseAction, updateLeaseAction } from "@/app/(dashboard)/property/leases/actions";
import type { ActionResult } from "@/lib/actions/result";
import type { Lease } from "@/lib/db/leases";
import type { Unit } from "@/lib/db/units";
import type { Tenant } from "@/lib/db/tenants";

const STATUS_OPTIONS = [
  { value: "draft",      label: "Draft" },
  { value: "active",     label: "Active" },
  { value: "expiring",   label: "Expiring" },
  { value: "ended",      label: "Ended" },
  { value: "terminated", label: "Terminated" },
];

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" loading={pending}>{label}</Button>;
}

export function LeaseForm({
  mode,
  lease,
  units,
  tenants,
}: {
  mode: "create" | "edit";
  lease?: Lease;
  units: Unit[];
  tenants: Tenant[];
}) {
  const router = useRouter();
  const toast = useToast();
  const action = mode === "create" ? createLeaseAction : updateLeaseAction.bind(null, lease!.id);
  const [state, formAction] = useActionState<ActionResult | null, FormData>(action, null);

  useEffect(() => {
    if (state?.ok) {
      toast.push(mode === "create" ? "Lease created" : "Lease updated", "success");
      if (mode === "edit") router.refresh();
    } else if (state && !state.ok) {
      toast.push(state.error, "error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const fieldError = (k: string) => (state && !state.ok ? state.fieldErrors?.[k] : undefined);

  const unitOptions = units.map((u) => ({
    value: u.id,
    label: u.unit_number + (u.property_name ? " — " + u.property_name : ""),
  }));
  const tenantOptions = tenants.map((t) => ({ value: t.id, label: t.full_name }));

  return (
    <Card className="max-w-2xl">
      <CardBody>
        <form action={formAction} className="space-y-4">
          <Select
            name="unit_id" label="Unit" options={unitOptions} placeholder="Select a unit"
            defaultValue={lease?.unit_id ?? ""} error={fieldError("unit_id")} required
          />
          <Select
            name="tenant_id" label="Tenant" options={tenantOptions} placeholder="Select a tenant"
            defaultValue={lease?.tenant_id ?? ""} error={fieldError("tenant_id")} required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input name="start_date" label="Start date" type="date" defaultValue={lease?.start_date ?? ""} error={fieldError("start_date")} required />
            <Input name="end_date" label="End date" type="date" defaultValue={lease?.end_date ?? ""} error={fieldError("end_date")} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input name="monthly_rent" label="Monthly rent (PHP)" type="number" step="0.01" min={0} defaultValue={lease?.monthly_rent ?? ""} error={fieldError("monthly_rent")} required />
            <Input name="deposit_amount" label="Deposit (PHP)" type="number" step="0.01" min={0} defaultValue={lease?.deposit_amount ?? 0} error={fieldError("deposit_amount")} />
          </div>
          <Input name="notice_period_days" label="Notice period (days)" type="number" min={0} defaultValue={lease?.notice_period_days ?? 30} error={fieldError("notice_period_days")} />
          <Select name="status" label="Status" options={STATUS_OPTIONS} defaultValue={lease?.status ?? "draft"} error={fieldError("status")} />
          <div className="flex items-center gap-3 pt-2">
            <SubmitButton label={mode === "create" ? "Create Lease" : "Save Changes"} />
            <Button type="button" variant="secondary" onClick={() => router.push("/property/leases")}>
              Cancel
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
`;

FILES["src/components/lease/lease-table.tsx"] =
`import Link from "next/link";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatPHP } from "@/lib/utils/format-php";
import type { Lease } from "@/lib/db/leases";

const STATUS_TONE: Record<string, "gray" | "green" | "yellow" | "red" | "blue"> = {
  draft: "gray", active: "green", expiring: "yellow", ended: "blue", terminated: "red",
};

export function LeaseTable({ leases }: { leases: Lease[] }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <Table>
        <THead>
          <TR>
            <TH>Unit</TH><TH>Tenant</TH><TH>Term</TH>
            <TH className="text-right">Rent</TH><TH>Status</TH>
            <TH className="text-right">Actions</TH>
          </TR>
        </THead>
        <TBody>
          {leases.map((l) => (
            <TR key={l.id}>
              <TD className="font-medium">
                <Link href={"/property/leases/" + l.id} className="text-brand-600 hover:underline">
                  {l.unit_number ?? "—"}
                </Link>
              </TD>
              <TD className="text-gray-600">{l.tenant_name ?? "—"}</TD>
              <TD className="text-gray-600 text-xs">
                {l.start_date} → {l.end_date}
              </TD>
              <TD className="text-right">{formatPHP(l.monthly_rent)}</TD>
              <TD><Badge tone={STATUS_TONE[l.status] ?? "gray"}>{l.status}</Badge></TD>
              <TD className="text-right">
                <Link href={"/property/leases/" + l.id} className="text-brand-600 hover:underline text-sm">
                  Edit
                </Link>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
`;

FILES["src/components/lease/terminate-lease-button.tsx"] =
`"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { terminateLeaseAction } from "@/app/(dashboard)/property/leases/actions";

export function TerminateLeaseButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const toast = useToast();

  function onClick() {
    if (!confirming) { setConfirming(true); return; }
    start(async () => {
      try {
        await terminateLeaseAction(id);
      } catch {
        toast.push("Failed to terminate lease", "error");
      }
    });
  }

  return (
    <Button variant={confirming ? "danger" : "secondary"} onClick={onClick} loading={pending}>
      {confirming ? "Click again to confirm" : "Terminate"}
    </Button>
  );
}
`;

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------
async function main() {
  const pkg = join(ROOT, "package.json");
  if (!(await exists(pkg))) {
    console.error("package.json not found. Run from project root.");
    process.exit(1);
  }

  const pkgText = await readFile(pkg, "utf8");
  if (!pkgText.includes('"apartment-portal"')) {
    console.warn("package.json name isn't 'apartment-portal'. Continue? (Enter to proceed)");
    await new Promise((r) => process.stdin.once("data", r));
  }

  console.log("Phase 1 Part 3 - Units, Tenants, Leases\n");

  let count = 0;
  for (const [relPath, content] of Object.entries(FILES)) {
    const full = join(ROOT, relPath);
    const exists_ = await exists(full);
    console.log((exists_ ? "  ~ " : "  + ") + relPath);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, content, "utf8");
    count++;
  }

  console.log("\nDone - " + count + " file(s) written.\n");
  console.log("Next:");
  console.log("  npm run typecheck");
  console.log("  npm run dev");
  console.log("\nTest:");
  console.log("  http://localhost:3000/property/units");
  console.log("  http://localhost:3000/property/tenants");
  console.log("  http://localhost:3000/property/leases");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});