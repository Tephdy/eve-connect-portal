import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AssetCreateInput, AssetUpdateInput } from "@/lib/schemas/job-order";

export type Asset = {
  id: string;
  unit_id: string;
  name: string;
  type: string | null;
  install_date: string | null;
  warranty_until: string | null;
  unit_number?: string;
};

async function enrich(rows: Asset[]): Promise<Asset[]> {
  if (rows.length === 0) return rows;
  const supabase = await createClient();
  const ids = Array.from(new Set(rows.map((r) => r.unit_id)));
  const { data: units } = await supabase.from("unit").select("id, unit_number").in("id", ids);
  const uMap = new Map((units ?? []).map((u) => [u.id, u.unit_number]));
  rows.forEach((r) => { r.unit_number = uMap.get(r.unit_id); });
  return rows;
}

export async function listAssets(): Promise<Asset[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("asset")
    .select("id, unit_id, name, type, install_date, warranty_until")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return enrich((data ?? []) as Asset[]);
}

export async function getAsset(id: string): Promise<Asset | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("asset")
    .select("id, unit_id, name, type, install_date, warranty_until")
    .eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const [e] = await enrich([data as Asset]);
  return e;
}

export async function createAsset(input: AssetCreateInput): Promise<Asset> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("asset")
    .insert({
      unit_id: input.unit_id,
      name: input.name,
      type: input.type || null,
      install_date: input.install_date || null,
      warranty_until: input.warranty_until || null,
    })
    .select("id, unit_id, name, type, install_date, warranty_until")
    .single();
  if (error) throw new Error(error.message);
  return data as Asset;
}

export async function updateAsset(id: string, input: AssetUpdateInput): Promise<Asset> {
  const supabase = await createClient();
  const patch: Record<string, unknown> = {};
  if (input.unit_id !== undefined) patch.unit_id = input.unit_id;
  if (input.name !== undefined) patch.name = input.name;
  if (input.type !== undefined) patch.type = input.type || null;
  if (input.install_date !== undefined) patch.install_date = input.install_date || null;
  if (input.warranty_until !== undefined) patch.warranty_until = input.warranty_until || null;
  const { data, error } = await supabase
    .from("asset").update(patch).eq("id", id)
    .select("id, unit_id, name, type, install_date, warranty_until")
    .single();
  if (error) throw new Error(error.message);
  return data as Asset;
}
