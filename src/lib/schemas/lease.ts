import { z } from "zod";

export const leaseStatuses = ["draft","active","expiring","ended","terminated"] as const;
export const leaseIntents = ["new","renew","extend"] as const;

export const leaseTerms = [
  "1_month",
  "3_months",
  "6_months",
  "1_year",
  "2_years",
  "3_years",
  "other",
] as const;

export const leaseCreateSchema = z.object({
  unit_id: z.string().uuid("Unit is required"),
  tenant_id: z.string().uuid("Tenant is required"),
  start_date: z.string().min(1, "Start date is required"),
  end_date: z.string().min(1, "End of contract is required"),
  move_in_date: z.string().optional().or(z.literal("")),
  due_date: z.string().optional().or(z.literal("")),
  intent: z.enum(leaseIntents).default("new"),
  term: z.enum(leaseTerms).optional(),
  monthly_rent: z.coerce.number().min(0),
  deposit_1: z.coerce.number().min(0).default(0),
  deposit_2: z.coerce.number().min(0).default(0),
  deposit_amount: z.coerce.number().min(0).default(0),
  notice_period_days: z.coerce.number().int().min(0).default(30),
  ad_ons: z.string().optional().or(z.literal("")),
  ad_ons_amount: z.coerce.number().min(0).default(0),
  status: z.enum(leaseStatuses).default("draft"),
}).refine((d) => new Date(d.end_date) > new Date(d.start_date), {
  message: "End of contract must be after start date",
  path: ["end_date"],
});

export const leaseUpdateSchema = leaseCreateSchema.innerType().partial();

export type LeaseCreateInput = z.infer<typeof leaseCreateSchema>;
export type LeaseUpdateInput = z.infer<typeof leaseUpdateSchema>;
