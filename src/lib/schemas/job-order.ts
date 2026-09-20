import { z } from "zod";

export const jobPriorities = ["low","normal","high","urgent"] as const;
export const jobStatuses = ["open","pending_approval","assigned","in_progress","done","cancelled"] as const;

export const jobOrderCreateSchema = z.object({
  unit_id: z.string().uuid("Unit is required"),
  task_type_id: z.string().uuid("Task type is required"),
  priority: z.enum(jobPriorities).default("normal"),
  description: z.string().min(5, "Description is too short").max(2000),
  cost_estimate: z.coerce.number().min(0).default(0),
  status: z.enum(jobStatuses).default("open"),
});

export const jobOrderUpdateSchema = jobOrderCreateSchema.partial();

export const workLogCreateSchema = z.object({
  job_order_id: z.string().uuid(),
  notes: z.string().min(1, "Notes required").max(2000),
  hours: z.coerce.number().min(0).optional(),
  parts_used: z.string().max(2000).optional().or(z.literal("")),
});

export const assetCreateSchema = z.object({
  unit_id: z.string().uuid("Unit is required"),
  name: z.string().min(1, "Name is required").max(200),
  type: z.string().max(100).optional().or(z.literal("")),
  install_date: z.string().optional().or(z.literal("")),
  warranty_until: z.string().optional().or(z.literal("")),
});

export const assetUpdateSchema = assetCreateSchema.partial();

export type JobOrderCreateInput = z.infer<typeof jobOrderCreateSchema>;
export type JobOrderUpdateInput = z.infer<typeof jobOrderUpdateSchema>;
export type WorkLogCreateInput = z.infer<typeof workLogCreateSchema>;
export type AssetCreateInput = z.infer<typeof assetCreateSchema>;
export type AssetUpdateInput = z.infer<typeof assetUpdateSchema>;
