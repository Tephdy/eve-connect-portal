import { onLeaseSigned } from "./consumers/lease-signed";
import { onLeaseCreated } from "./consumers/lease-created";
import { onLeaseTerminated } from "./consumers/lease-terminated";
import { onTenantCreated } from "./consumers/tenant-created";
import { onJobOrderCreated } from "./consumers/joborder-created";
import { onJobOrderCostApproved } from "./consumers/joborder-cost-approved";
import { onJobOrderCostRejected } from "./consumers/joborder-cost-rejected";
import { onJobOrderCompleted } from "./consumers/joborder-completed";
import { onInvoicePaid } from "./consumers/invoice-paid";

export const handlers: Record<string, (payload: any) => Promise<void>> = {
  "tenant.created": onTenantCreated,
  "lease.created": onLeaseCreated,
  "lease.signed": onLeaseSigned,
  "lease.terminated": onLeaseTerminated,
  "joborder.created": onJobOrderCreated,
  "joborder.cost_approved": onJobOrderCostApproved,
  "joborder.cost_rejected": onJobOrderCostRejected,
  "joborder.completed": onJobOrderCompleted,
  "invoice.paid": onInvoicePaid,
};
