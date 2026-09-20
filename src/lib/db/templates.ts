import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { TemplateCreateInput, TemplateUpdateInput } from "@/lib/schemas/contract";

export type ContractTemplate = {
  id: string;
  name: string;
  body_markdown: string;
  version: number;
  active: boolean;
};

export async function listTemplates(): Promise<ContractTemplate[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contract_template")
    .select("id, name, body_markdown, version, active")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ContractTemplate[];
}

export async function getTemplate(id: string): Promise<ContractTemplate | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contract_template")
    .select("id, name, body_markdown, version, active")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ContractTemplate) ?? null;
}

export async function createTemplate(input: TemplateCreateInput): Promise<ContractTemplate> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contract_template")
    .insert({
      name: input.name,
      body_markdown: input.body_markdown,
      active: input.active,
    })
    .select("id, name, body_markdown, version, active")
    .single();
  if (error) throw new Error(error.message);
  return data as ContractTemplate;
}

export async function updateTemplate(
  id: string,
  input: TemplateUpdateInput
): Promise<ContractTemplate> {
  const supabase = await createClient();
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.body_markdown !== undefined) patch.body_markdown = input.body_markdown;
  if (input.active !== undefined) patch.active = input.active;
  const { data, error } = await supabase
    .from("contract_template")
    .update(patch)
    .eq("id", id)
    .select("id, name, body_markdown, version, active")
    .single();
  if (error) throw new Error(error.message);
  return data as ContractTemplate;
}

export async function archiveTemplate(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("contract_template")
    .update({ active: false })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
