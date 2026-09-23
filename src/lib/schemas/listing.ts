import { z } from "zod";

export const listingStatuses = ["draft","published","unlisted"] as const;

export const listingCreateSchema = z.object({
  unit_id: z.string().uuid("Unit is required"),
  title: z.string().min(3, "Title is too short").max(200),
  description: z.string().max(4000).optional().or(z.literal("")),
  asking_rent: z.coerce.number().min(0).optional(),
  status: z.enum(listingStatuses).default("draft"),
});

export const listingUpdateSchema = listingCreateSchema.partial();

export const inquiryCreateSchema = z.object({
  unit_id: z.string().uuid().optional().or(z.literal("")),
  prospect_name: z.string().min(1, "Name is required").max(200),
  contact: z.string().max(200).optional().or(z.literal("")),
    email: z.string().email().optional().or(z.literal("")),
    messenger_name: z.string().max(200).optional().or(z.literal("")),
    government_id: z.string().max(100).optional().or(z.literal("")),
  source: z.string().max(100).optional().or(z.literal("")),
  status: z.enum(["open","contacted","converted","lost"]).default("open"),
});

export const inquiryUpdateSchema = inquiryCreateSchema.partial();

export const forecastOverrideSchema = z.object({
  unit_id: z.string().uuid(),
  earliest_available_date: z.string().min(1),
  confidence: z.enum(["confirmed","estimated"]).default("estimated"),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

export type ListingCreateInput = z.infer<typeof listingCreateSchema>;
export type ListingUpdateInput = z.infer<typeof listingUpdateSchema>;
export type InquiryCreateInput = z.infer<typeof inquiryCreateSchema>;
export type InquiryUpdateInput = z.infer<typeof inquiryUpdateSchema>;
export type ForecastOverrideInput = z.infer<typeof forecastOverrideSchema>;
