import { z } from "zod";

export const tenantStatuses = ["prospect","active","former","blacklisted"] as const;

export const tenantCreateSchema = z.object({
  full_name: z.string().min(1, "Full name is required").max(200),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().max(50).optional().or(z.literal("")),
  messenger_name: z.string().max(200).optional().or(z.literal("")),
  government_id: z.string().max(100).optional().or(z.literal("")),
  status: z.enum(tenantStatuses).default("prospect"),
});

export const tenantUpdateSchema = tenantCreateSchema.partial();

export type TenantCreateInput = z.infer<typeof tenantCreateSchema>;
export type TenantUpdateInput = z.infer<typeof tenantUpdateSchema>;