#!/usr/bin/env node
/**
 * Fix — rewrite event consumers with clean syntax
 * (the cleanup script left dangling multi-line console.log() arguments)
 * Usage: node fix-consumers.mjs
 */

import { mkdir, writeFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import { join, dirname } from "node:path";

const ROOT = process.cwd();
const FILES = {};

async function exists(p) {
  try { await access(p, constants.F_OK); return true; } catch { return false; }
}

// =============================================================================
// consumers
// =============================================================================

FILES["src/lib/events/consumers/tenant-created.ts"] =
`import "server-only";

export async function onTenantCreated(_payload: { tenant_id: string }) {
  // Reserved for Phase 3+ (accounting ledger initialization).
}
`;

FILES["src/lib/events/consumers/lease-created.ts"] =
`import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function onLeaseCreated(payload: {
  lease_id: string;
  unit_id: string;
  tenant_id: string;
}) {
  const admin = createAdminClient();
  await admin.from("unit").update({ status: "reserved" }).eq("id", payload.unit_id);
}
`;

FILES["src/lib/events/consumers/lease-signed.ts"] =
`import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function onLeaseSigned(payload: {
  lease_id: string;
  contract_id: string;
  signed_at: string;
}) {
  const admin = createAdminClient();

  const { data: lease } = await admin
    .from("lease")
    .select("id, unit_id, tenant_id, start_date, end_date, monthly_rent, deposit_amount")
    .eq("id", payload.lease_id)
    .single();

  if (!lease) return;

  await admin.from("lease").update({ status: "active" }).eq("id", lease.id);
  await admin.from("unit").update({ status: "occupied" }).eq("id", lease.unit_id);

  if (Number(lease.deposit_amount) > 0) {
    await admin.from("invoice").insert({
      lease_id: lease.id,
      type: "deposit",
      amount: lease.deposit_amount,
      due_date: lease.start_date,
      status: "unpaid",
    });

    await admin.from("deposit").insert({
      lease_id: lease.id,
      amount: lease.deposit_amount,
      status: "held",
      refunded_amount: 0,
    });
  }

  await admin.from("invoice").insert({
    lease_id: lease.id,
    type: "rent",
    amount: lease.monthly_rent,
    due_date: lease.start_date,
    status: "unpaid",
  });
}
`;

FILES["src/lib/events/consumers/lease-terminated.ts"] =
`import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function onLeaseTerminated(payload: {
  lease_id: string;
  unit_id: string;
}) {
  const admin = createAdminClient();
  await admin.from("unit").update({ status: "vacant" }).eq("id", payload.unit_id);
}
`;

FILES["src/lib/events/consumers/joborder-created.ts"] =
`import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function onJobOrderCreated(payload: {
  joborder_id: string;
  unit_id: string;
  task_type_id: string;
  cost_estimate: number;
}) {
  const admin = createAdminClient();

  const { data: type } = await admin
    .from("job_task_type")
    .select("approval_threshold_php, name")
    .eq("id", payload.task_type_id)
    .single();

  if (!type) return;

  const threshold = Number(type.approval_threshold_php);
  const cost = Number(payload.cost_estimate ?? 0);

  if (cost > threshold) {
    await admin
      .from("job_order")
      .update({ status: "pending_approval" })
      .eq("id", payload.joborder_id);
  }
}
`;

FILES["src/lib/events/consumers/joborder-cost-approved.ts"] =
`import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function onJobOrderCostApproved(payload: { joborder_id: string }) {
  const admin = createAdminClient();
  await admin.from("job_order").update({ status: "assigned" }).eq("id", payload.joborder_id);
}
`;

FILES["src/lib/events/consumers/joborder-cost-rejected.ts"] =
`import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function onJobOrderCostRejected(payload: {
  joborder_id: string;
  reason: string;
}) {
  const admin = createAdminClient();
  await admin.from("job_order").update({ status: "cancelled" }).eq("id", payload.joborder_id);
}
`;

FILES["src/lib/events/consumers/joborder-completed.ts"] =
`import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function onJobOrderCompleted(payload: {
  joborder_id: string;
  unit_id: string;
}) {
  const admin = createAdminClient();
  await admin.from("unit").update({ status: "vacant" }).eq("id", payload.unit_id);
}
`;

FILES["src/lib/events/consumers/invoice-paid.ts"] =
`import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function onInvoicePaid(payload: {
  payment_id: string;
  invoice_id: string;
  amount: number;
}) {
  const admin = createAdminClient();

  const { data: invoice } = await admin
    .from("invoice")
    .select("id, lease_id")
    .eq("id", payload.invoice_id)
    .single();
  if (!invoice) return;

  const { data: lease } = await admin
    .from("lease")
    .select("tenant_id")
    .eq("id", invoice.lease_id)
    .single();
  if (!lease) return;

  const { data: last } = await admin
    .from("ledger_entry")
    .select("balance_after")
    .eq("tenant_id", lease.tenant_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const prev = last ? Number(last.balance_after) : 0;
  const balance_after = prev - Number(payload.amount);

  await admin.from("ledger_entry").insert({
    tenant_id: lease.tenant_id,
    type: "credit",
    amount: payload.amount,
    balance_after,
    ref_invoice_id: payload.invoice_id,
  });
}
`;

// =============================================================================
// registry (in case a consumer name changed)
// =============================================================================
FILES["src/lib/events/registry.ts"] =
`import { onLeaseSigned } from "./consumers/lease-signed";
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
`;

// =============================================================================
// job-task-types (clean the debug logs too)
// =============================================================================
FILES["src/lib/db/job-task-types.ts"] =
`import "server-only";
import { createClient } from "@/lib/supabase/server";

export type JobTaskType = {
  id: string;
  key: string;
  name: string;
  approval_threshold_php: number;
};

const FALLBACK_TASK_TYPES: JobTaskType[] = [
  { id: "plumbing",     key: "plumbing",     name: "Plumbing",         approval_threshold_php: 5000  },
  { id: "electrical",   key: "electrical",   name: "Electrical",       approval_threshold_php: 5000  },
  { id: "hvac",         key: "hvac",         name: "HVAC / Aircon",    approval_threshold_php: 8000  },
  { id: "appliance",    key: "appliance",    name: "Appliance Repair", approval_threshold_php: 3000  },
  { id: "carpentry",    key: "carpentry",    name: "Carpentry",        approval_threshold_php: 2000  },
  { id: "painting",     key: "painting",     name: "Painting",         approval_threshold_php: 2000  },
  { id: "cleaning",     key: "cleaning",     name: "Cleaning",         approval_threshold_php: 1000  },
  { id: "pest_control", key: "pest_control", name: "Pest Control",     approval_threshold_php: 1500  },
  { id: "turnover",     key: "turnover",     name: "Unit Turnover",    approval_threshold_php: 10000 },
  { id: "other",        key: "other",        name: "Other",            approval_threshold_php: 3000  },
];

export async function listTaskTypes(): Promise<JobTaskType[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_task_type")
    .select("id, key, name, approval_threshold_php")
    .order("name", { ascending: true });

  if (error) {
    console.warn("[listTaskTypes] query failed:", error.message);
    return FALLBACK_TASK_TYPES;
  }

  const rows = (data ?? []) as JobTaskType[];
  if (rows.length === 0) {
    console.warn("[listTaskTypes] empty, using fallback");
    return FALLBACK_TASK_TYPES;
  }

  return rows;
}

export async function updateTaskType(
  id: string,
  threshold: number
): Promise<JobTaskType> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_task_type")
    .update({ approval_threshold_php: threshold })
    .eq("id", id)
    .select("id, key, name, approval_threshold_php")
    .single();
  if (error) throw new Error(error.message);
  return data as JobTaskType;
}
`;

// -----------------------------------------------------------------------------
// Runner
// -----------------------------------------------------------------------------
async function main() {
  const pkg = join(ROOT, "package.json");
  if (!(await exists(pkg))) {
    console.error("package.json not found. Run from project root.");
    process.exit(1);
  }

  console.log("Fix event consumers and job-task-types\n");

  let count = 0;
  for (const [relPath, content] of Object.entries(FILES)) {
    const full = join(ROOT, relPath);
    const exists_ = await exists(full);
    console.log((exists_ ? "  ~ " : "  + ") + relPath);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, content, "utf8");
    count++;
  }

  console.log("\nDone - " + count + " file(s) written.\n");
  console.log("Next:");
  console.log("  npm run typecheck");
  console.log("  npm run dev");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});