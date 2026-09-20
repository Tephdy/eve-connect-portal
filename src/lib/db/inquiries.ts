import "server-only";
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
