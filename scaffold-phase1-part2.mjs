#!/usr/bin/env node
/**
 * Phase 1 Part 2 - Property CRUD scaffolder
 * Usage: node scaffold-phase1-part2.mjs
 * Run from project root.
 */

import { mkdir, writeFile, access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { join, dirname } from "node:path";

const ROOT = process.cwd();

async function exists(p) {
  try { await access(p, constants.F_OK); return true; } catch { return false; }
}

const FILES = {};

// 1. Zod schema
FILES["src/lib/schemas/property.ts"] =
`import { z } from "zod";

export const propertyTypes = ["residential", "commercial", "mixed"] as const;

export const propertyCreateSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  address: z.string().max(500).optional().or(z.literal("")),
  type: z.enum(propertyTypes).default("residential"),
  total_units: z.coerce.number().int().min(0).default(0),
});

export const propertyUpdateSchema = propertyCreateSchema.partial();

export type PropertyCreateInput = z.infer<typeof propertyCreateSchema>;
export type PropertyUpdateInput = z.infer<typeof propertyUpdateSchema>;
`;

// 2. Data access layer
FILES["src/lib/db/properties.ts"] =
`import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { PropertyCreateInput, PropertyUpdateInput } from "@/lib/schemas/property";

export type Property = {
  id: string;
  name: string;
  address: string | null;
  type: "residential" | "commercial" | "mixed";
  total_units: number;
  created_at: string;
  archived_at: string | null;
};

export async function listProperties(): Promise<Property[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("property")
    .select("id, name, address, type, total_units, created_at, archived_at")
    .is("archived_at", null)
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Property[];
}

export async function getProperty(id: string): Promise<Property | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("property")
    .select("id, name, address, type, total_units, created_at, archived_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Property) ?? null;
}

export async function createProperty(input: PropertyCreateInput): Promise<Property> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("property")
    .insert({
      name: input.name,
      address: input.address || null,
      type: input.type,
      total_units: input.total_units ?? 0,
    })
    .select("id, name, address, type, total_units, created_at, archived_at")
    .single();
  if (error) throw new Error(error.message);
  return data as Property;
}

export async function updateProperty(id: string, input: PropertyUpdateInput): Promise<Property> {
  const supabase = await createClient();
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.address !== undefined) patch.address = input.address || null;
  if (input.type !== undefined) patch.type = input.type;
  if (input.total_units !== undefined) patch.total_units = input.total_units;
  const { data, error } = await supabase
    .from("property")
    .update(patch)
    .eq("id", id)
    .select("id, name, address, type, total_units, created_at, archived_at")
    .single();
  if (error) throw new Error(error.message);
  return data as Property;
}

export async function archiveProperty(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("property")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
`;

// 3. List page
FILES["src/app/(dashboard)/property/properties/page.tsx"] =
`import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/guard";
import { listProperties } from "@/lib/db/properties";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { PropertyTable } from "@/components/property/property-table";

export default async function PropertiesPage() {
  await requirePagePermission("property:read");
  const properties = await listProperties();

  return (
    <div>
      <PageHeader
        title="Properties"
        description="All properties in the portfolio."
        action={
          <Link href="/property/properties/new">
            <Button>+ New Property</Button>
          </Link>
        }
      />
      {properties.length === 0 ? (
        <EmptyState
          title="No properties yet"
          description="Create your first property to get started."
          action={
            <Link href="/property/properties/new">
              <Button>+ New Property</Button>
            </Link>
          }
        />
      ) : (
        <PropertyTable properties={properties} />
      )}
    </div>
  );
}
`;

// 4. Server actions
FILES["src/app/(dashboard)/property/properties/actions.ts"] =
`"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertPermission } from "@/lib/auth/guard";
import { getSession } from "@/lib/auth/get-session";
import { createProperty, updateProperty, archiveProperty } from "@/lib/db/properties";
import { logAudit } from "@/lib/audit/log";
import { propertyCreateSchema, propertyUpdateSchema } from "@/lib/schemas/property";
import { parseForm } from "@/lib/forms/parse";
import type { ActionResult } from "@/lib/actions/result";

export async function createPropertyAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await assertPermission("property:create");
  const parsed = parseForm(propertyCreateSchema, formData);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error, fieldErrors: parsed.fieldErrors };
  }
  const session = await getSession();
  const property = await createProperty(parsed.data);
  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "property",
    entity_id: property.id,
    action: "create",
    after: property,
  });
  revalidatePath("/property/properties");
  redirect("/property/properties/" + property.id);
}

export async function updatePropertyAction(
  id: string,
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await assertPermission("property:update");
  const parsed = parseForm(propertyUpdateSchema, formData);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error, fieldErrors: parsed.fieldErrors };
  }
  const session = await getSession();
  const updated = await updateProperty(id, parsed.data);
  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "property",
    entity_id: id,
    action: "update",
    after: updated,
  });
  revalidatePath("/property/properties");
  revalidatePath("/property/properties/" + id);
  return { ok: true, data: undefined };
}

export async function archivePropertyAction(id: string): Promise<void> {
  await assertPermission("property:archive");
  const session = await getSession();
  await archiveProperty(id);
  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "property",
    entity_id: id,
    action: "archive",
  });
  revalidatePath("/property/properties");
  redirect("/property/properties");
}
`;

// 5. New page
FILES["src/app/(dashboard)/property/properties/new/page.tsx"] =
`import { requirePagePermission } from "@/lib/auth/guard";
import { PageHeader } from "@/components/layout/page-header";
import { PropertyForm } from "@/components/property/property-form";

export default async function NewPropertyPage() {
  await requirePagePermission("property:create");
  return (
    <div>
      <PageHeader
        title="New Property"
        description="Add a property to the portfolio."
      />
      <PropertyForm mode="create" />
    </div>
  );
}
`;

// 6. Detail page
FILES["src/app/(dashboard)/property/properties/[id]/page.tsx"] =
`import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/guard";
import { getProperty } from "@/lib/db/properties";
import { PageHeader } from "@/components/layout/page-header";
import { PropertyForm } from "@/components/property/property-form";
import { ArchivePropertyButton } from "@/components/property/archive-property-button";

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("property:read");
  const { id } = await params;
  const property = await getProperty(id);
  if (!property) notFound();

  const createdLabel = new Date(property.created_at).toLocaleDateString("en-PH");

  return (
    <div>
      <PageHeader
        title={property.name}
        description={"Created " + createdLabel}
        action={<ArchivePropertyButton id={property.id} />}
      />
      <PropertyForm mode="edit" property={property} />
    </div>
  );
}
`;

// 7. Property form
FILES["src/components/property/property-form.tsx"] =
`"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import {
  createPropertyAction,
  updatePropertyAction,
} from "@/app/(dashboard)/property/properties/actions";
import type { ActionResult } from "@/lib/actions/result";
import type { Property } from "@/lib/db/properties";

const TYPE_OPTIONS = [
  { value: "residential", label: "Residential" },
  { value: "commercial",  label: "Commercial" },
  { value: "mixed",       label: "Mixed" },
];

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      {label}
    </Button>
  );
}

export function PropertyForm({
  mode,
  property,
}: {
  mode: "create" | "edit";
  property?: Property;
}) {
  const router = useRouter();
  const toast = useToast();

  const action =
    mode === "create"
      ? createPropertyAction
      : updatePropertyAction.bind(null, property!.id);

  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    action,
    null
  );

  useEffect(() => {
    if (state?.ok) {
      toast.push(mode === "create" ? "Property created" : "Property updated", "success");
      if (mode === "edit") router.refresh();
    } else if (state && !state.ok) {
      toast.push(state.error, "error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const fieldError = (key: string) =>
    state && !state.ok ? state.fieldErrors?.[key] : undefined;

  return (
    <Card className="max-w-2xl">
      <CardBody>
        <form action={formAction} className="space-y-4">
          <Input
            name="name"
            label="Property name"
            defaultValue={property?.name ?? ""}
            error={fieldError("name")}
            required
          />
          <Input
            name="address"
            label="Address"
            defaultValue={property?.address ?? ""}
            error={fieldError("address")}
          />
          <Select
            name="type"
            label="Type"
            options={TYPE_OPTIONS}
            defaultValue={property?.type ?? "residential"}
            error={fieldError("type")}
          />
          <Input
            name="total_units"
            label="Total units"
            type="number"
            min={0}
            defaultValue={property?.total_units ?? 0}
            error={fieldError("total_units")}
          />
          <div className="flex items-center gap-3 pt-2">
            <SubmitButton label={mode === "create" ? "Create Property" : "Save Changes"} />
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push("/property/properties")}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
`;

// 8. Property table
FILES["src/components/property/property-table.tsx"] =
`import Link from "next/link";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { Property } from "@/lib/db/properties";

const TYPE_TONE: Record<string, "blue" | "purple" | "gray"> = {
  residential: "blue",
  commercial:  "purple",
  mixed:       "gray",
};

export function PropertyTable({ properties }: { properties: Property[] }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <Table>
        <THead>
          <TR>
            <TH>Name</TH>
            <TH>Type</TH>
            <TH>Address</TH>
            <TH className="text-right">Units</TH>
            <TH className="text-right">Actions</TH>
          </TR>
        </THead>
        <TBody>
          {properties.map((p) => (
            <TR key={p.id}>
              <TD className="font-medium">
                <Link
                  href={"/property/properties/" + p.id}
                  className="text-brand-600 hover:underline"
                >
                  {p.name}
                </Link>
              </TD>
              <TD>
                <Badge tone={TYPE_TONE[p.type] ?? "gray"}>{p.type}</Badge>
              </TD>
              <TD className="text-gray-600">{p.address ?? "—"}</TD>
              <TD className="text-right">{p.total_units}</TD>
              <TD className="text-right">
                <Link
                  href={"/property/properties/" + p.id}
                  className="text-brand-600 hover:underline text-sm"
                >
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

// 9. Archive button
FILES["src/components/property/archive-property-button.tsx"] =
`"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { archivePropertyAction } from "@/app/(dashboard)/property/properties/actions";

export function ArchivePropertyButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const toast = useToast();

  function onClick() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    start(async () => {
      try {
        await archivePropertyAction(id);
      } catch {
        toast.push("Failed to archive", "error");
      }
    });
  }

  return (
    <Button
      variant={confirming ? "danger" : "secondary"}
      onClick={onClick}
      loading={pending}
    >
      {confirming ? "Click again to confirm" : "Archive"}
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

  console.log("Phase 1 Part 2 - Property CRUD\n");

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
  console.log("  http://localhost:3000/property/properties");
  console.log("  http://localhost:3000/property/properties/new");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});