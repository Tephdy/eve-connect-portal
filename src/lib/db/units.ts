import "server-only";
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
