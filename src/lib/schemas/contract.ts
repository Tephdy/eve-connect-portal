import { z } from "zod";

export const templateCreateSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  body_markdown: z.string().min(20, "Body is too short").max(100000),
  active: z.coerce.boolean().default(true),
});

export const templateUpdateSchema = templateCreateSchema.partial();

export const contractCreateSchema = z.object({
  lease_id: z.string().uuid("Lease is required"),
  template_id: z.string().uuid("Template is required"),
});

export type TemplateCreateInput = z.infer<typeof templateCreateSchema>;
export type TemplateUpdateInput = z.infer<typeof templateUpdateSchema>;
export type ContractCreateInput = z.infer<typeof contractCreateSchema>;
