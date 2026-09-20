import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { PropertyCreateInput, PropertyUpdateInput } from "@/lib/schemas/property";

export type Property = {
  id: string;
  name: string;
  address: string | null;
  type: "studio_unit" | "one_two_bedroom" | "bedspace";
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
