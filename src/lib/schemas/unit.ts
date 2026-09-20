import { z } from "zod";

export const unitStatuses = ["vacant","occupied","reserved","maintenance","unavailable"] as const;

export const unitCreateSchema = z.object({
  property_id: z.string().uuid("Property is required"),
  unit_number: z.string().min(1, "Unit number is required").max(50),
  floor: z.coerce.number().int().optional(),
  bedrooms: z.coerce.number().int().min(0).optional(),
  bathrooms: z.coerce.number().min(0).optional(),
  area_sqm: z.coerce.number().min(0).optional(),
  base_rent: z.coerce.number().min(0).optional(),
  status: z.enum(unitStatuses).default("vacant"),
});

export const unitUpdateSchema = unitCreateSchema.partial();

export type UnitCreateInput = z.infer<typeof unitCreateSchema>;
export type UnitUpdateInput = z.infer<typeof unitUpdateSchema>;
