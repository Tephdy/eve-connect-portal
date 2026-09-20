#!/usr/bin/env node
/**
 * Phase 4 - Marketing module
 * Usage: node scaffold-phase4.mjs
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
// SCHEMAS
// =============================================================================

FILES["src/lib/schemas/listing.ts"] =
`import { z } from "zod";

export const listingStatuses = ["draft","published","unlisted"] as const;

export const listingCreateSchema = z.object({
  unit_id: z.string().uuid("Unit is required"),
  title: z.string().min(3, "Title is too short").max(200),
  description: z.string().max(4000).optional().or(z.literal("")),
  asking_rent: z.coerce.number().min(0).optional(),
  status: z.enum(listingStatuses).default("draft"),
});

export const listingUpdateSchema = listingCreateSchema.partial();

export const inquiryCreateSchema = z.object({
  unit_id: z.string().uuid().optional().or(z.literal("")),
  prospect_name: z.string().min(1, "Name is required").max(200),
  contact: z.string().max(200).optional().or(z.literal("")),
  source: z.string().max(100).optional().or(z.literal("")),
  status: z.enum(["open","contacted","converted","lost"]).default("open"),
});

export const inquiryUpdateSchema = inquiryCreateSchema.partial();

export const forecastOverrideSchema = z.object({
  unit_id: z.string().uuid(),
  earliest_available_date: z.string().min(1),
  confidence: z.enum(["confirmed","estimated"]).default("estimated"),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

export type ListingCreateInput = z.infer<typeof listingCreateSchema>;
export type ListingUpdateInput = z.infer<typeof listingUpdateSchema>;
export type InquiryCreateInput = z.infer<typeof inquiryCreateSchema>;
export type InquiryUpdateInput = z.infer<typeof inquiryUpdateSchema>;
export type ForecastOverrideInput = z.infer<typeof forecastOverrideSchema>;
`;

// =============================================================================
// DB: listings
// =============================================================================

FILES["src/lib/db/listings.ts"] =
`import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ListingCreateInput, ListingUpdateInput } from "@/lib/schemas/listing";

export type Listing = {
  id: string;
  unit_id: string;
  title: string;
  description: string | null;
  photos: unknown;
  asking_rent: number | null;
  published_at: string | null;
  status: "draft" | "published" | "unlisted";
  unit_number?: string;
  property_name?: string;
};

const LISTING_SELECT =
  "id, unit_id, title, description, photos, asking_rent, published_at, status";

async function enrich(rows: Listing[]): Promise<Listing[]> {
  if (rows.length === 0) return rows;
  const supabase = await createClient();
  const unitIds = Array.from(new Set(rows.map((r) => r.unit_id)));
  const { data: units } = await supabase
    .from("unit").select("id, unit_number, property_id").in("id", unitIds);

  const propIds = Array.from(new Set((units ?? []).map((u: any) => u.property_id)));
  const { data: props } = propIds.length > 0
    ? await supabase.from("property").select("id, name").in("id", propIds)
    : { data: [] as { id: string; name: string }[] };

  const uMap = new Map((units ?? []).map((u: any) => [u.id, u]));
  const pMap = new Map((props ?? []).map((p) => [p.id, p.name]));

  rows.forEach((r) => {
    const u = uMap.get(r.unit_id) as any;
    r.unit_number = u?.unit_number;
    r.property_name = u ? pMap.get(u.property_id) : undefined;
  });
  return rows;
}

export async function listListings(filter?: "all" | "draft" | "published" | "unlisted"): Promise<Listing[]> {
  const supabase = await createClient();
  let q = supabase.from("listing").select(LISTING_SELECT).order("id", { ascending: false });
  if (filter && filter !== "all") q = q.eq("status", filter);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return enrich((data ?? []) as Listing[]);
}

export async function getListing(id: string): Promise<Listing | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listing").select(LISTING_SELECT).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const [e] = await enrich([data as Listing]);
  return e;
}

export async function getListingByUnit(unit_id: string): Promise<Listing | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listing").select(LISTING_SELECT).eq("unit_id", unit_id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Listing) ?? null;
}

export async function createListing(input: ListingCreateInput): Promise<Listing> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("listing")
    .insert({
      unit_id: input.unit_id,
      title: input.title,
      description: input.description || null,
      asking_rent: input.asking_rent ?? null,
      status: input.status,
    })
    .select(LISTING_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return data as Listing;
}

export async function updateListing(id: string, input: ListingUpdateInput): Promise<Listing> {
  const admin = createAdminClient();
  const patch: Record<string, unknown> = {};
  if (input.unit_id !== undefined) patch.unit_id = input.unit_id;
  if (input.title !== undefined) patch.title = input.title;
  if (input.description !== undefined) patch.description = input.description || null;
  if (input.asking_rent !== undefined) patch.asking_rent = input.asking_rent ?? null;
  if (input.status !== undefined) {
    patch.status = input.status;
    if (input.status === "published") patch.published_at = new Date().toISOString();
  }
  const { data, error } = await admin
    .from("listing").update(patch).eq("id", id).select(LISTING_SELECT).single();
  if (error) throw new Error(error.message);
  return data as Listing;
}

export async function publishListing(id: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("listing")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function unpublishListing(id: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("listing").update({ status: "unlisted" }).eq("id", id);
  if (error) throw new Error(error.message);
}
`;

// =============================================================================
// DB: forecast
// =============================================================================

FILES["src/lib/db/forecast.ts"] =
`import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type Forecast = {
  id: string;
  unit_id: string;
  earliest_available_date: string;
  confidence: "confirmed" | "estimated";
  notes: string | null;
  computed_at: string;
  unit_number?: string;
  property_name?: string;
};

async function enrich(rows: Forecast[]): Promise<Forecast[]> {
  if (rows.length === 0) return rows;
  const supabase = await createClient();
  const unitIds = Array.from(new Set(rows.map((r) => r.unit_id)));
  const { data: units } = await supabase
    .from("unit").select("id, unit_number, property_id").in("id", unitIds);

  const propIds = Array.from(new Set((units ?? []).map((u: any) => u.property_id)));
  const { data: props } = propIds.length > 0
    ? await supabase.from("property").select("id, name").in("id", propIds)
    : { data: [] as { id: string; name: string }[] };

  const uMap = new Map((units ?? []).map((u: any) => [u.id, u]));
  const pMap = new Map((props ?? []).map((p) => [p.id, p.name]));

  rows.forEach((r) => {
    const u = uMap.get(r.unit_id) as any;
    r.unit_number = u?.unit_number;
    r.property_name = u ? pMap.get(u.property_id) : undefined;
  });
  return rows;
}

export async function listForecasts(): Promise<Forecast[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("availability_forecast")
    .select("id, unit_id, earliest_available_date, confidence, notes, computed_at")
    .order("earliest_available_date", { ascending: true });
  if (error) throw new Error(error.message);
  return enrich((data ?? []) as Forecast[]);
}

export async function upsertForecast(input: {
  unit_id: string;
  earliest_available_date: string;
  confidence: "confirmed" | "estimated";
  notes: string | null;
}): Promise<Forecast> {
  const admin = createAdminClient();
  // Upsert: one forecast per unit (latest)
  const { data: existing } = await admin
    .from("availability_forecast").select("id").eq("unit_id", input.unit_id).maybeSingle();

  if (existing) {
    const { data, error } = await admin
      .from("availability_forecast")
      .update({
        earliest_available_date: input.earliest_available_date,
        confidence: input.confidence,
        notes: input.notes,
        computed_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("id, unit_id, earliest_available_date, confidence, notes, computed_at")
      .single();
    if (error) throw new Error(error.message);
    return data as Forecast;
  }

  const { data, error } = await admin
    .from("availability_forecast")
    .insert({
      unit_id: input.unit_id,
      earliest_available_date: input.earliest_available_date,
      confidence: input.confidence,
      notes: input.notes,
    })
    .select("id, unit_id, earliest_available_date, confidence, notes, computed_at")
    .single();
  if (error) throw new Error(error.message);
  return data as Forecast;
}

/**
 * Deterministic forecast:
 * For each unit, compute earliest_available_date based on:
 *  - vacant units: today
 *  - occupied units: lease.end_date + notice_period_days
 *  - maintenance: today + 7 days buffer
 */
export async function recalculateForecasts(): Promise<number> {
  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: units } = await admin
    .from("unit")
    .select("id, status");

  if (!units) return 0;

  let count = 0;

  for (const unit of units) {
    let date = today;
    let confidence: "confirmed" | "estimated" = "confirmed";

    if (unit.status === "occupied") {
      const { data: lease } = await admin
        .from("lease")
        .select("end_date, notice_period_days, status")
        .eq("unit_id", unit.id)
        .in("status", ["active", "expiring"])
        .order("end_date", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (lease) {
        const end = new Date(lease.end_date);
        const bufferDays = Number(lease.notice_period_days ?? 0) + 7; // +7 turnover buffer
        end.setDate(end.getDate() + bufferDays);
        date = end.toISOString().slice(0, 10);
        confidence = "estimated";
      }
    } else if (unit.status === "maintenance") {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      date = d.toISOString().slice(0, 10);
      confidence = "estimated";
    }

    await upsertForecast({
      unit_id: unit.id,
      earliest_available_date: date,
      confidence,
      notes: null,
    });
    count++;
  }
  return count;
}
`;

// =============================================================================
// DB: inquiries
// =============================================================================

FILES["src/lib/db/inquiries.ts"] =
`import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { InquiryCreateInput, InquiryUpdateInput } from "@/lib/schemas/listing";

export type Inquiry = {
  id: string;
  unit_id: string | null;
  prospect_name: string;
  contact: string | null;
  source: string | null;
  status: "open" | "contacted" | "converted" | "lost";
  created_at: string;
  unit_number?: string;
};

const INQUIRY_SELECT =
  "id, unit_id, prospect_name, contact, source, status, created_at";

async function enrich(rows: Inquiry[]): Promise<Inquiry[]> {
  if (rows.length === 0) return rows;
  const supabase = await createClient();
  const unitIds = Array.from(new Set(rows.map((r) => r.unit_id).filter(Boolean))) as string[];
  const { data: units } = unitIds.length > 0
    ? await supabase.from("unit").select("id, unit_number").in("id", unitIds)
    : { data: [] as { id: string; unit_number: string }[] };
  const map = new Map((units ?? []).map((u) => [u.id, u.unit_number]));
  rows.forEach((r) => { if (r.unit_id) r.unit_number = map.get(r.unit_id); });
  return rows;
}

export async function listInquiries(): Promise<Inquiry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inquiry").select(INQUIRY_SELECT).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return enrich((data ?? []) as Inquiry[]);
}

export async function getInquiry(id: string): Promise<Inquiry | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inquiry").select(INQUIRY_SELECT).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const [e] = await enrich([data as Inquiry]);
  return e;
}

export async function createInquiry(input: InquiryCreateInput): Promise<Inquiry> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("inquiry")
    .insert({
      unit_id: input.unit_id || null,
      prospect_name: input.prospect_name,
      contact: input.contact || null,
      source: input.source || null,
      status: input.status,
    })
    .select(INQUIRY_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return data as Inquiry;
}

export async function updateInquiry(id: string, input: InquiryUpdateInput): Promise<Inquiry> {
  const admin = createAdminClient();
  const patch: Record<string, unknown> = {};
  if (input.unit_id !== undefined) patch.unit_id = input.unit_id || null;
  if (input.prospect_name !== undefined) patch.prospect_name = input.prospect_name;
  if (input.contact !== undefined) patch.contact = input.contact || null;
  if (input.source !== undefined) patch.source = input.source || null;
  if (input.status !== undefined) patch.status = input.status;
  const { data, error } = await admin
    .from("inquiry").update(patch).eq("id", id).select(INQUIRY_SELECT).single();
  if (error) throw new Error(error.message);
  return data as Inquiry;
}

export async function dashboardStats(): Promise<{
  total_units: number;
  vacant: number;
  occupied: number;
  occupancy_pct: number;
  published_listings: number;
  open_inquiries: number;
}> {
  const supabase = await createClient();
  const [{ data: units }, { data: listings }, { data: inquiries }] = await Promise.all([
    supabase.from("unit").select("status"),
    supabase.from("listing").select("id").eq("status", "published"),
    supabase.from("inquiry").select("id").in("status", ["open", "contacted"]),
  ]);

  const total = (units ?? []).length;
  const vacant = (units ?? []).filter((u: any) => u.status === "vacant").length;
  const occupied = (units ?? []).filter((u: any) => u.status === "occupied").length;
  const occ = total > 0 ? Math.round((occupied / total) * 100) : 0;

  return {
    total_units: total,
    vacant,
    occupied,
    occupancy_pct: occ,
    published_listings: (listings ?? []).length,
    open_inquiries: (inquiries ?? []).length,
  };
}
`;

// =============================================================================
// PAGES — Marketing dashboard
// =============================================================================

FILES["src/app/(dashboard)/marketing/page.tsx"] =
`import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/guard";
import { dashboardStats } from "@/lib/db/inquiries";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function MarketingHome() {
  await requirePagePermission("listing:read");
  const stats = await dashboardStats();

  return (
    <div>
      <PageHeader
        title="Marketing"
        description="Listings, availability, and inquiries."
        action={
          <div className="flex gap-2">
            <Link href="/marketing/listings/new"><Button>+ New Listing</Button></Link>
            <Link href="/marketing/inquiries/new"><Button variant="secondary">+ New Inquiry</Button></Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <Stat label="Total units" value={String(stats.total_units)} tone="text-gray-900" />
        <Stat label="Occupancy" value={stats.occupancy_pct + "%"} tone="text-green-700" />
        <Stat label="Vacant" value={String(stats.vacant)} tone="text-yellow-700" />
        <Stat label="Published listings" value={String(stats.published_listings)} tone="text-brand-600" />
        <Stat label="Open inquiries" value={String(stats.open_inquiries)} tone="text-gray-900" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <QuickCard href="/marketing/listings" title="Listings" desc="Draft, publish, and manage unit listings." />
        <QuickCard href="/marketing/forecast" title="Availability Forecast" desc="Earliest available date per unit." />
        <QuickCard href="/marketing/inquiries" title="Inquiries" desc="Track prospects and conversions." />
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <Card><CardBody>
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={"text-2xl font-semibold mt-1 " + tone}>{value}</p>
    </CardBody></Card>
  );
}

function QuickCard({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link href={href} className="block">
      <Card className="hover:border-brand-500 transition-colors"><CardBody>
        <p className="font-medium text-brand-600">{title}</p>
        <p className="text-sm text-gray-500 mt-1">{desc}</p>
      </CardBody></Card>
    </Link>
  );
}
`;

// =============================================================================
// PAGES — Listings
// =============================================================================

FILES["src/app/(dashboard)/marketing/listings/page.tsx"] =
`import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/guard";
import { listListings } from "@/lib/db/listings";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { ListingTable } from "@/components/marketing/listing-table";

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  await requirePagePermission("listing:read");
  const sp = await searchParams;
  const filter = (sp.filter as "all" | "draft" | "published" | "unlisted") ?? "all";
  const listings = await listListings(filter);

  const tabs = [
    { key: "all", label: "All" },
    { key: "published", label: "Published" },
    { key: "draft", label: "Draft" },
    { key: "unlisted", label: "Unlisted" },
  ];

  return (
    <div>
      <PageHeader
        title="Listings"
        description="Unit listings across the portfolio."
        action={<Link href="/marketing/listings/new"><Button>+ New Listing</Button></Link>}
      />
      <div className="flex gap-2 mb-4">
        {tabs.map((t) => (
          <Link key={t.key} href={"/marketing/listings?filter=" + t.key}
            className={"px-3 py-1.5 rounded text-sm " +
              (filter === t.key
                ? "bg-brand-500 text-white"
                : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50")}>
            {t.label}
          </Link>
        ))}
      </div>
      {listings.length === 0 ? (
        <EmptyState title="No listings" description="Create a listing for a vacant unit." />
      ) : (
        <ListingTable listings={listings} />
      )}
    </div>
  );
}
`;

FILES["src/app/(dashboard)/marketing/listings/new/page.tsx"] =
`import { requirePagePermission } from "@/lib/auth/guard";
import { listUnits } from "@/lib/db/units";
import { PageHeader } from "@/components/layout/page-header";
import { ListingForm } from "@/components/marketing/listing-form";

export default async function NewListingPage() {
  await requirePagePermission("listing:create");
  const units = await listUnits();
  const vacant = units.filter((u) => u.status === "vacant" || u.status === "reserved");
  return (
    <div>
      <PageHeader title="New Listing" description="Publish a unit to the market." />
      <ListingForm mode="create" units={vacant} />
    </div>
  );
}
`;

FILES["src/app/(dashboard)/marketing/listings/[id]/page.tsx"] =
`import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/guard";
import { getListing } from "@/lib/db/listings";
import { listUnits } from "@/lib/db/units";
import { PageHeader } from "@/components/layout/page-header";
import { ListingForm } from "@/components/marketing/listing-form";
import { PublishToggle } from "@/components/marketing/publish-toggle";

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("listing:read");
  const { id } = await params;
  const listing = await getListing(id);
  if (!listing) notFound();

  const units = await listUnits();
  const vacant = units.filter((u) => u.status === "vacant" || u.status === "reserved" || u.id === listing.unit_id);

  return (
    <div>
      <PageHeader
        title={listing.title}
        description={(listing.unit_number ?? "") + " — " + (listing.property_name ?? "")}
        action={<PublishToggle id={listing.id} status={listing.status} />}
      />
      <ListingForm mode="edit" listing={listing} units={vacant} />
    </div>
  );
}
`;

FILES["src/app/(dashboard)/marketing/listings/actions.ts"] =
`"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertPermission } from "@/lib/auth/guard";
import { getSession } from "@/lib/auth/get-session";
import {
  createListing, updateListing, publishListing, unpublishListing,
} from "@/lib/db/listings";
import { logAudit } from "@/lib/audit/log";
import { emit } from "@/lib/events/emit";
import { listingCreateSchema, listingUpdateSchema } from "@/lib/schemas/listing";
import { parseForm } from "@/lib/forms/parse";
import type { ActionResult } from "@/lib/actions/result";

export async function createListingAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await assertPermission("listing:create");
  const parsed = parseForm(listingCreateSchema, formData);
  if (!parsed.ok) return { ok: false, error: parsed.error, fieldErrors: parsed.fieldErrors };
  const session = await getSession();
  const listing = await createListing(parsed.data);
  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "listing", entity_id: listing.id, action: "create", after: listing,
  });
  revalidatePath("/marketing/listings");
  redirect("/marketing/listings/" + listing.id);
}

export async function updateListingAction(
  id: string,
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await assertPermission("listing:update");
  const parsed = parseForm(listingUpdateSchema, formData);
  if (!parsed.ok) return { ok: false, error: parsed.error, fieldErrors: parsed.fieldErrors };
  const session = await getSession();
  const updated = await updateListing(id, parsed.data);
  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "listing", entity_id: id, action: "update", after: updated,
  });
  revalidatePath("/marketing/listings");
  revalidatePath("/marketing/listings/" + id);
  return { ok: true, data: undefined };
}

export async function publishListingAction(id: string) {
  await assertPermission("listing:publish");
  const session = await getSession();
  await publishListing(id);
  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "listing", entity_id: id, action: "update",
    after: { status: "published" },
  });
  await emit("listing.published", { listing_id: id }, session?.id ?? null);
  revalidatePath("/marketing/listings");
  revalidatePath("/marketing/listings/" + id);
}

export async function unpublishListingAction(id: string) {
  await assertPermission("listing:publish");
  const session = await getSession();
  await unpublishListing(id);
  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "listing", entity_id: id, action: "update",
    after: { status: "unlisted" },
  });
  revalidatePath("/marketing/listings");
  revalidatePath("/marketing/listings/" + id);
}
`;

// =============================================================================
// PAGES — Forecast
// =============================================================================

FILES["src/app/(dashboard)/marketing/forecast/page.tsx"] =
`import { requirePagePermission } from "@/lib/auth/guard";
import { listForecasts } from "@/lib/db/forecast";
import { listUnits } from "@/lib/db/units";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { ForecastTable } from "@/components/marketing/forecast-table";

export default async function ForecastPage() {
  await requirePagePermission("forecast:read");
  const [forecasts, units] = await Promise.all([listForecasts(), listUnits()]);

  return (
    <div>
      <PageHeader
        title="Availability Forecast"
        description="Earliest available date per unit."
      />
      {units.length === 0 ? (
        <EmptyState title="No units" description="Add units first." />
      ) : (
        <ForecastTable forecasts={forecasts} units={units} />
      )}
    </div>
  );
}
`;

FILES["src/app/(dashboard)/marketing/forecast/actions.ts"] =
`"use server";

import { revalidatePath } from "next/cache";
import { assertPermission } from "@/lib/auth/guard";
import { getSession } from "@/lib/auth/get-session";
import { upsertForecast, recalculateForecasts } from "@/lib/db/forecast";
import { logAudit } from "@/lib/audit/log";
import { emit } from "@/lib/events/emit";
import { forecastOverrideSchema } from "@/lib/schemas/listing";
import { parseForm } from "@/lib/forms/parse";
import type { ActionResult } from "@/lib/actions/result";

export async function overrideForecastAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await assertPermission("forecast:override");
  const parsed = parseForm(forecastOverrideSchema, formData);
  if (!parsed.ok) return { ok: false, error: parsed.error, fieldErrors: parsed.fieldErrors };

  const session = await getSession();
  const result = await upsertForecast({
    unit_id: parsed.data.unit_id,
    earliest_available_date: parsed.data.earliest_available_date,
    confidence: parsed.data.confidence,
    notes: parsed.data.notes || null,
  });

  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "availability_forecast",
    entity_id: result.id,
    action: "update",
    after: result,
  });

  await emit("forecast.recalculated", {
    unit_id: result.unit_id,
    earliest_available_date: result.earliest_available_date,
    confidence: result.confidence,
  }, session?.id ?? null);

  revalidatePath("/marketing/forecast");
  return { ok: true, data: undefined };
}

export async function recalculateAllAction(): Promise<void> {
  await assertPermission("forecast:override");
  await recalculateForecasts();
  revalidatePath("/marketing/forecast");
}
`;

// =============================================================================
// PAGES — Inquiries
// =============================================================================

FILES["src/app/(dashboard)/marketing/inquiries/page.tsx"] =
`import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/guard";
import { listInquiries } from "@/lib/db/inquiries";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { InquiryTable } from "@/components/marketing/inquiry-table";

export default async function InquiriesPage() {
  await requirePagePermission("inquiry:read");
  const inquiries = await listInquiries();
  return (
    <div>
      <PageHeader
        title="Inquiries"
        description="Prospects and their status."
        action={<Link href="/marketing/inquiries/new"><Button>+ New Inquiry</Button></Link>}
      />
      {inquiries.length === 0 ? (
        <EmptyState title="No inquiries" description="Log your first prospect." />
      ) : (
        <InquiryTable inquiries={inquiries} />
      )}
    </div>
  );
}
`;

FILES["src/app/(dashboard)/marketing/inquiries/new/page.tsx"] =
`import { requirePagePermission } from "@/lib/auth/guard";
import { listUnits } from "@/lib/db/units";
import { PageHeader } from "@/components/layout/page-header";
import { InquiryForm } from "@/components/marketing/inquiry-form";

export default async function NewInquiryPage() {
  await requirePagePermission("inquiry:create");
  const units = await listUnits();
  return (
    <div>
      <PageHeader title="New Inquiry" description="Log a prospect." />
      <InquiryForm mode="create" units={units} />
    </div>
  );
}
`;

FILES["src/app/(dashboard)/marketing/inquiries/[id]/page.tsx"] =
`import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/guard";
import { getInquiry } from "@/lib/db/inquiries";
import { listUnits } from "@/lib/db/units";
import { PageHeader } from "@/components/layout/page-header";
import { InquiryForm } from "@/components/marketing/inquiry-form";

export default async function InquiryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("inquiry:read");
  const { id } = await params;
  const inquiry = await getInquiry(id);
  if (!inquiry) notFound();
  const units = await listUnits();
  return (
    <div>
      <PageHeader title={inquiry.prospect_name} description={inquiry.contact ?? ""} />
      <InquiryForm mode="edit" inquiry={inquiry} units={units} />
    </div>
  );
}
`;

FILES["src/app/(dashboard)/marketing/inquiries/actions.ts"] =
`"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertPermission } from "@/lib/auth/guard";
import { getSession } from "@/lib/auth/get-session";
import { createInquiry, updateInquiry } from "@/lib/db/inquiries";
import { logAudit } from "@/lib/audit/log";
import { inquiryCreateSchema, inquiryUpdateSchema } from "@/lib/schemas/listing";
import { parseForm } from "@/lib/forms/parse";
import type { ActionResult } from "@/lib/actions/result";

export async function createInquiryAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await assertPermission("inquiry:create");
  const parsed = parseForm(inquiryCreateSchema, formData);
  if (!parsed.ok) return { ok: false, error: parsed.error, fieldErrors: parsed.fieldErrors };
  const session = await getSession();
  const inquiry = await createInquiry(parsed.data);
  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "inquiry", entity_id: inquiry.id, action: "create", after: inquiry,
  });
  revalidatePath("/marketing/inquiries");
  redirect("/marketing/inquiries/" + inquiry.id);
}

export async function updateInquiryAction(
  id: string,
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await assertPermission("inquiry:update");
  const parsed = parseForm(inquiryUpdateSchema, formData);
  if (!parsed.ok) return { ok: false, error: parsed.error, fieldErrors: parsed.fieldErrors };
  const session = await getSession();
  const updated = await updateInquiry(id, parsed.data);
  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "inquiry", entity_id: id, action: "update", after: updated,
  });
  revalidatePath("/marketing/inquiries");
  revalidatePath("/marketing/inquiries/" + id);
  return { ok: true, data: undefined };
}
`;

// =============================================================================
// COMPONENTS
// =============================================================================

FILES["src/components/marketing/listing-table.tsx"] =
`import Link from "next/link";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatPHP } from "@/lib/utils/format-php";
import type { Listing } from "@/lib/db/listings";

const STATUS_TONE: Record<string, "gray" | "green" | "yellow"> = {
  draft: "gray", published: "green", unlisted: "yellow",
};

export function ListingTable({ listings }: { listings: Listing[] }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <Table>
        <THead>
          <TR>
            <TH>Title</TH><TH>Unit</TH><TH>Property</TH>
            <TH className="text-right">Asking</TH><TH>Status</TH>
            <TH className="text-right">Actions</TH>
          </TR>
        </THead>
        <TBody>
          {listings.map((l) => (
            <TR key={l.id}>
              <TD className="font-medium">
                <Link href={"/marketing/listings/" + l.id} className="text-brand-600 hover:underline">
                  {l.title}
                </Link>
              </TD>
              <TD className="text-gray-600">{l.unit_number ?? "—"}</TD>
              <TD className="text-gray-600">{l.property_name ?? "—"}</TD>
              <TD className="text-right">{l.asking_rent != null ? formatPHP(l.asking_rent) : "—"}</TD>
              <TD><Badge tone={STATUS_TONE[l.status] ?? "gray"}>{l.status}</Badge></TD>
              <TD className="text-right">
                <Link href={"/marketing/listings/" + l.id} className="text-brand-600 hover:underline text-sm">
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

FILES["src/components/marketing/listing-form.tsx"] =
`"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { createListingAction, updateListingAction } from "@/app/(dashboard)/marketing/listings/actions";
import type { ActionResult } from "@/lib/actions/result";
import type { Listing } from "@/lib/db/listings";
import type { Unit } from "@/lib/db/units";

const STATUSES = [
  { value: "draft",     label: "Draft" },
  { value: "published", label: "Published" },
  { value: "unlisted",  label: "Unlisted" },
];

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" loading={pending}>{label}</Button>;
}

export function ListingForm({
  mode, listing, units,
}: { mode: "create" | "edit"; listing?: Listing; units: Unit[] }) {
  const router = useRouter();
  const toast = useToast();
  const action = mode === "create" ? createListingAction : updateListingAction.bind(null, listing!.id);
  const [state, formAction] = useActionState<ActionResult | null, FormData>(action, null);

  useEffect(() => {
    if (state?.ok) {
      toast.push(mode === "create" ? "Listing created" : "Listing updated", "success");
      if (mode === "edit") router.refresh();
    } else if (state && !state.ok) toast.push(state.error, "error");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const fieldError = (k: string) => (state && !state.ok ? state.fieldErrors?.[k] : undefined);

  const unitOptions = units.map((u) => ({
    value: u.id,
    label: u.unit_number + (u.property_name ? " — " + u.property_name : ""),
  }));

  return (
    <Card className="max-w-2xl">
      <CardBody>
        <form action={formAction} className="space-y-4">
          <Select
            name="unit_id" label="Unit" options={unitOptions} placeholder="Select a unit"
            defaultValue={listing?.unit_id ?? ""} error={fieldError("unit_id")} required
          />
          <Input
            name="title" label="Title" defaultValue={listing?.title ?? ""}
            error={fieldError("title")} required
          />
          <Textarea
            name="description" label="Description" rows={5}
            defaultValue={listing?.description ?? ""} error={fieldError("description")}
          />
          <Input
            name="asking_rent" label="Asking rent (PHP)" type="number" step="0.01" min={0}
            defaultValue={listing?.asking_rent ?? ""} error={fieldError("asking_rent")}
          />
          <Select name="status" label="Status" options={STATUSES}
            defaultValue={listing?.status ?? "draft"} error={fieldError("status")} />
          <div className="flex items-center gap-3 pt-2">
            <SubmitButton label={mode === "create" ? "Create Listing" : "Save Changes"} />
            <Button type="button" variant="secondary" onClick={() => router.push("/marketing/listings")}>
              Cancel
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
`;

FILES["src/components/marketing/publish-toggle.tsx"] =
`"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { publishListingAction, unpublishListingAction } from "@/app/(dashboard)/marketing/listings/actions";

export function PublishToggle({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();
  const toast = useToast();

  function onPublish() {
    start(async () => {
      try {
        await publishListingAction(id);
        toast.push("Listing published", "success");
      } catch { toast.push("Failed", "error"); }
    });
  }

  function onUnpublish() {
    start(async () => {
      try {
        await unpublishListingAction(id);
        toast.push("Listing unpublished", "success");
      } catch { toast.push("Failed", "error"); }
    });
  }

  if (status === "published") {
    return <Button variant="secondary" onClick={onUnpublish} loading={pending}>Unpublish</Button>;
  }
  return <Button onClick={onPublish} loading={pending}>Publish</Button>;
}
`;

FILES["src/components/marketing/forecast-table.tsx"] =
`"use client";

import { useState, useTransition } from "react";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { overrideForecastAction, recalculateAllAction } from "@/app/(dashboard)/marketing/forecast/actions";
import type { Forecast } from "@/lib/db/forecast";
import type { Unit } from "@/lib/db/units";

export function ForecastTable({ forecasts, units }: { forecasts: Forecast[]; units: Unit[] }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const [editing, setEditing] = useState<string | null>(null);

  const map = new Map(forecasts.map((f) => [f.unit_id, f]));

  function recalc() {
    start(async () => {
      try {
        await recalculateAllAction();
        toast.push("Forecasts recalculated", "success");
      } catch { toast.push("Failed", "error"); }
    });
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <Button variant="secondary" onClick={recalc} loading={pending}>
          Recalculate all
        </Button>
      </div>
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <Table>
          <THead>
            <TR>
              <TH>Unit</TH><TH>Property</TH>
              <TH>Earliest available</TH><TH>Confidence</TH>
              <TH>Status</TH><TH className="text-right">Action</TH>
            </TR>
          </THead>
          <TBody>
            {units.map((u) => {
              const f = map.get(u.id);
              return (
                <TR key={u.id}>
                  <TD className="font-medium">{u.unit_number}</TD>
                  <TD className="text-gray-600">{u.property_name ?? "—"}</TD>
                  <TD>{f?.earliest_available_date ?? "—"}</TD>
                  <TD>
                    {f ? <Badge tone={f.confidence === "confirmed" ? "green" : "yellow"}>{f.confidence}</Badge> : "—"}
                  </TD>
                  <TD><Badge tone="gray">{u.status}</Badge></TD>
                  <TD className="text-right">
                    <Button size="sm" variant="secondary"
                      onClick={() => setEditing(editing === u.id ? null : u.id)}>
                      {editing === u.id ? "Cancel" : "Override"}
                    </Button>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </div>

      {editing && (
        <OverrideForm
          unit={units.find((u) => u.id === editing)!}
          forecast={map.get(editing)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function OverrideForm({
  unit, forecast, onClose,
}: { unit: Unit; forecast?: Forecast; onClose: () => void }) {
  const toast = useToast();
  const [state, formAction] = useOverrideAction(onClose);

  return (
    <form action={formAction} className="bg-white border border-gray-200 rounded-lg p-5 mt-4 space-y-3">
      <p className="font-medium">Override forecast for Unit {unit.unit_number}</p>
      <input type="hidden" name="unit_id" value={unit.id} />
      <div className="grid grid-cols-3 gap-3">
        <Input name="earliest_available_date" label="Earliest available" type="date"
          defaultValue={forecast?.earliest_available_date ?? ""} required />
        <Select name="confidence" label="Confidence"
          options={[{ value: "confirmed", label: "Confirmed" }, { value: "estimated", label: "Estimated" }]}
          defaultValue={forecast?.confidence ?? "estimated"} />
        <Input name="notes" label="Notes" defaultValue={forecast?.notes ?? ""} />
      </div>
      <div className="flex gap-2">
        <Button type="submit">Save override</Button>
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
      </div>
    </form>
  );
}

function useOverrideAction(onSuccess: () => void) {
  const toast = useToast();
  const [state, formAction] = useActionState<ActionResult | null, FormData>(overrideForecastAction, null);

  useEffect(() => {
    if (state?.ok) {
      toast.push("Forecast updated", "success");
      onSuccess();
    } else if (state && !state.ok) toast.push(state.error, "error");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return [state, formAction] as const;
}

// Local imports to avoid circular
import { useActionState, useEffect } from "react";
import type { ActionResult } from "@/lib/actions/result";
`;

FILES["src/components/marketing/inquiry-table.tsx"] =
`import Link from "next/link";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { Inquiry } from "@/lib/db/inquiries";

const STATUS_TONE: Record<string, "gray" | "green" | "yellow" | "red"> = {
  open: "yellow", contacted: "blue" as any, converted: "green", lost: "red",
};

export function InquiryTable({ inquiries }: { inquiries: Inquiry[] }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <Table>
        <THead>
          <TR>
            <TH>Prospect</TH><TH>Contact</TH><TH>Unit</TH>
            <TH>Source</TH><TH>Status</TH><TH className="text-right">Actions</TH>
          </TR>
        </THead>
        <TBody>
          {inquiries.map((i) => (
            <TR key={i.id}>
              <TD className="font-medium">
                <Link href={"/marketing/inquiries/" + i.id} className="text-brand-600 hover:underline">
                  {i.prospect_name}
                </Link>
              </TD>
              <TD className="text-gray-600">{i.contact ?? "—"}</TD>
              <TD className="text-gray-600">{i.unit_number ?? "—"}</TD>
              <TD className="text-gray-600">{i.source ?? "—"}</TD>
              <TD><Badge tone={STATUS_TONE[i.status] ?? "gray"}>{i.status}</Badge></TD>
              <TD className="text-right">
                <Link href={"/marketing/inquiries/" + i.id} className="text-brand-600 hover:underline text-sm">
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

FILES["src/components/marketing/inquiry-form.tsx"] =
`"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { createInquiryAction, updateInquiryAction } from "@/app/(dashboard)/marketing/inquiries/actions";
import type { ActionResult } from "@/lib/actions/result";
import type { Inquiry } from "@/lib/db/inquiries";
import type { Unit } from "@/lib/db/units";

const STATUSES = [
  { value: "open",      label: "Open" },
  { value: "contacted", label: "Contacted" },
  { value: "converted", label: "Converted" },
  { value: "lost",      label: "Lost" },
];

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" loading={pending}>{label}</Button>;
}

export function InquiryForm({
  mode, inquiry, units,
}: { mode: "create" | "edit"; inquiry?: Inquiry; units: Unit[] }) {
  const router = useRouter();
  const toast = useToast();
  const action = mode === "create" ? createInquiryAction : updateInquiryAction.bind(null, inquiry!.id);
  const [state, formAction] = useActionState<ActionResult | null, FormData>(action, null);

  useEffect(() => {
    if (state?.ok) {
      toast.push(mode === "create" ? "Inquiry created" : "Inquiry updated", "success");
      if (mode === "edit") router.refresh();
    } else if (state && !state.ok) toast.push(state.error, "error");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const fieldError = (k: string) => (state && !state.ok ? state.fieldErrors?.[k] : undefined);

  const unitOptions = units.map((u) => ({
    value: u.id,
    label: u.unit_number + (u.property_name ? " — " + u.property_name : ""),
  }));

  return (
    <Card className="max-w-2xl">
      <CardBody>
        <form action={formAction} className="space-y-4">
          <Input name="prospect_name" label="Prospect name"
            defaultValue={inquiry?.prospect_name ?? ""} error={fieldError("prospect_name")} required />
          <Input name="contact" label="Contact (email / phone)"
            defaultValue={inquiry?.contact ?? ""} error={fieldError("contact")} />
          <Select name="unit_id" label="Interested unit (optional)"
            options={unitOptions} placeholder="Any unit"
            defaultValue={inquiry?.unit_id ?? ""} error={fieldError("unit_id")} />
          <Input name="source" label="Source" hint="e.g. Facebook, referral, walk-in"
            defaultValue={inquiry?.source ?? ""} error={fieldError("source")} />
          <Select name="status" label="Status" options={STATUSES}
            defaultValue={inquiry?.status ?? "open"} error={fieldError("status")} />
          <div className="flex items-center gap-3 pt-2">
            <SubmitButton label={mode === "create" ? "Create Inquiry" : "Save Changes"} />
            <Button type="button" variant="secondary" onClick={() => router.push("/marketing/inquiries")}>
              Cancel
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
`;

// =============================================================================
// CRON — forecast recalc
// =============================================================================

FILES["src/app/api/cron/forecast/route.ts"] =
`import { NextResponse } from "next/server";
import { recalculateForecasts } from "@/lib/db/forecast";

export async function GET() {
  const count = await recalculateForecasts();
  return NextResponse.json({ recalculated: count });
}

export async function POST() { return GET(); }
`;

// =============================================================================
// SIDEBAR UPDATE
// =============================================================================

FILES["src/components/shell/sidebar.tsx"] =
`import Link from "next/link";
import type { UserRole } from "@/lib/auth/get-user-roles";

type NavItem = { href: string; label: string; roles: string[] };
type NavGroup = { label: string; roles: string[]; items: NavItem[] };

const GROUPS: NavGroup[] = [
  { label: "Overview", roles: ["*"],
    items: [{ href: "/dashboard", label: "Dashboard", roles: ["*"] }] },
  { label: "Property",
    roles: ["property_rep", "executive", "marketing", "maintenance"],
    items: [
      { href: "/property/properties", label: "Properties", roles: ["property_rep", "executive"] },
      { href: "/property/units",      label: "Units",      roles: ["property_rep", "executive", "marketing", "maintenance"] },
      { href: "/property/tenants",    label: "Tenants",    roles: ["property_rep", "executive"] },
      { href: "/property/leases",     label: "Leases",     roles: ["property_rep", "executive"] },
      { href: "/property/contracts",  label: "Contracts",  roles: ["property_rep", "executive"] },
      { href: "/property/templates",  label: "Templates",  roles: ["property_rep", "executive"] },
    ] },
  { label: "Marketing", roles: ["marketing", "executive"],
    items: [
      { href: "/marketing",            label: "Overview",   roles: ["marketing", "executive"] },
      { href: "/marketing/listings",   label: "Listings",   roles: ["marketing", "executive"] },
      { href: "/marketing/forecast",   label: "Forecast",   roles: ["marketing", "executive", "property_rep"] },
      { href: "/marketing/inquiries",  label: "Inquiries",  roles: ["marketing", "executive"] },
    ] },
  { label: "Accounting", roles: ["accounting", "executive"],
    items: [
      { href: "/accounting",           label: "Overview",  roles: ["accounting", "executive"] },
      { href: "/accounting/invoices",  label: "Invoices",  roles: ["accounting", "executive"] },
      { href: "/accounting/payments",  label: "Payments",  roles: ["accounting", "executive"] },
      { href: "/accounting/deposits",  label: "Deposits",  roles: ["accounting", "executive"] },
      { href: "/accounting/approvals", label: "Approvals", roles: ["accounting", "executive"] },
    ] },
  { label: "Maintenance", roles: ["maintenance", "executive", "property_rep"],
    items: [
      { href: "/maintenance",                label: "Job Orders",    roles: ["maintenance", "executive", "property_rep"] },
      { href: "/maintenance/job-orders/new", label: "New Job Order", roles: ["maintenance", "property_rep"] },
      { href: "/maintenance/assets",         label: "Assets",        roles: ["maintenance", "executive"] },
      { href: "/maintenance/task-types",     label: "Task Types",    roles: ["executive"] },
    ] },
  { label: "Admin", roles: ["executive", "system_admin"],
    items: [
      { href: "/executive", label: "Executive",    roles: ["executive"] },
      { href: "/admin",     label: "System Admin", roles: ["system_admin"] },
    ] },
];

export function Sidebar({ roles }: { roles: UserRole[] }) {
  const keys = roles.map((r) => r.role_key);
  const visibleGroups: NavGroup[] = GROUPS.map((g) => {
    if (!g.roles.includes("*") && !g.roles.some((r) => keys.includes(r))) return null;
    const items = g.items.filter(
      (item) => item.roles.includes("*") || item.roles.some((r) => keys.includes(r))
    );
    if (items.length === 0) return null;
    return { ...g, items };
  }).filter((g): g is NavGroup => g !== null);

  return (
    <aside className="w-60 bg-white border-r border-gray-200 flex flex-col">
      <div className="h-14 flex items-center px-4 border-b border-gray-200">
        <span className="font-semibold text-brand-500">Apartment Portal</span>
      </div>
      <nav className="flex-1 overflow-y-auto p-2 space-y-4">
        {visibleGroups.map((g) => (
          <div key={g.label}>
            <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
              {g.label}
            </p>
            {g.items.map((item) => (
              <Link key={item.href} href={item.href}
                className="block px-3 py-1.5 rounded text-sm text-gray-700 hover:bg-gray-100">
                {item.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>
    </aside>
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
  console.log("Phase 4 - Marketing module\\n");
  let count = 0;
  for (const [relPath, content] of Object.entries(FILES)) {
    const full = join(ROOT, relPath);
    const exists_ = await exists(full);
    console.log((exists_ ? "  ~ " : "  + ") + relPath);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, content, "utf8");
    count++;
  }
  console.log("\\nDone - " + count + " file(s) written.\\n");
  console.log("Next:");
  console.log("  1. Run the 020_marketing_extras.sql migration in Supabase SQL Editor");
  console.log("  2. npm run typecheck");
  console.log("  3. npm run dev");
  console.log("\\nTest:");
  console.log("  http://localhost:3000/marketing");
  console.log("  http://localhost:3000/marketing/listings");
  console.log("  http://localhost:3000/marketing/forecast");
  console.log("  http://localhost:3000/marketing/inquiries");
  console.log("\\nRecalc forecasts:");
  console.log("  curl.exe http://localhost:3000/api/cron/forecast");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});