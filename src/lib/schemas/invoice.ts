import { z } from "zod";

export const invoiceTypes = ["rent","deposit","penalty","other"] as const;
export const invoiceStatuses = ["unpaid","paid","overdue","void"] as const;

export const invoiceCreateSchema = z.object({
  lease_id: z.string().uuid("Lease is required"),
  type: z.enum(invoiceTypes).default("rent"),
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
  due_date: z.string().min(1, "Due date is required"),
});

export const paymentCreateSchema = z.object({
  invoice_id: z.string().uuid(),
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
  method: z.enum(["cash","bank_transfer","gcash","maya","check","other"]),
  reference_no: z.string().max(100).optional().or(z.literal("")),
});

export type InvoiceCreateInput = z.infer<typeof invoiceCreateSchema>;
export type PaymentCreateInput = z.infer<typeof paymentCreateSchema>;
