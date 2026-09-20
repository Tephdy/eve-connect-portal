import { z } from "zod";

export const propertyTypes = ["studio_unit", "one_two_bedroom", "bedspace"] as const;

export const propertyCreateSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  address: z.string().max(500).optional().or(z.literal("")),
  type: z.enum(propertyTypes).default("studio_unit"),
  total_units: z.coerce.number().int().min(0).default(0),
});

export const propertyUpdateSchema = propertyCreateSchema.partial();

export type PropertyCreateInput = z.infer<typeof propertyCreateSchema>;
export type PropertyUpdateInput = z.infer<typeof propertyUpdateSchema>;