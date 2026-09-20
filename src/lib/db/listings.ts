import "server-only";
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
