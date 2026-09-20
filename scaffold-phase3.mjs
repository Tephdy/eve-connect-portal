#!/usr/bin/env node
/**
 * Phase 3 - Accounting module
 * Usage: node scaffold-phase3.mjs
 */

import { mkdir, writeFile, access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { join, dirname } from "node:path";

const ROOT = process.cwd();
const FILES = {};

async function exists(p) {
  try { await access(p, constants.F_OK); return true; } catch { return false; }
}

// =============================================================================
// SCHEMAS
// =============================================================================

FILES["src/lib/schemas/invoice.ts"] =
`import { z } from "zod";

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
`;

// =============================================================================
// DB: invoices
// =============================================================================

FILES["src/lib/db/invoices.ts"] =
`import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { InvoiceCreateInput } from "@/lib/schemas/invoice";

export type Invoice = {
  id: string;
  lease_id: string;
  type: "rent" | "deposit" | "penalty" | "other";
  amount: number;
  due_date: string;
  status: "unpaid" | "paid" | "overdue" | "void";
  created_at: string;
  display_number: string | null;
  tenant_name?: string;
  unit_number?: string;
  paid_amount?: number;
};

const INVOICE_SELECT =
  "id, lease_id, type, amount, due_date, status, created_at, display_number";

async function enrich(rows: Invoice[]): Promise<Invoice[]> {
  if (rows.length === 0) return rows;
  const supabase = await createClient();
  const leaseIds = Array.from(new Set(rows.map((r) => r.lease_id)));

  const { data: leases } = await supabase
    .from("lease")
    .select("id, tenant_id, unit_id")
    .in("id", leaseIds);

  const tenantIds = Array.from(new Set((leases ?? []).map((l) => l.tenant_id)));
  const unitIds   = Array.from(new Set((leases ?? []).map((l) => l.unit_id)));

  const [{ data: tenants }, { data: units }] = await Promise.all([
    tenantIds.length > 0
      ? supabase.from("tenant").select("id, full_name").in("id", tenantIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    unitIds.length > 0
      ? supabase.from("unit").select("id, unit_number").in("id", unitIds)
      : Promise.resolve({ data: [] as { id: string; unit_number: string }[] }),
  ]);

  const lMap = new Map((leases ?? []).map((l) => [l.id, l]));
  const tMap = new Map((tenants ?? []).map((t) => [t.id, t.full_name]));
  const uMap = new Map((units ?? []).map((u) => [u.id, u.unit_number]));

  rows.forEach((r) => {
    const l = lMap.get(r.lease_id);
    if (l) {
      r.tenant_name = tMap.get(l.tenant_id);
      r.unit_number = uMap.get(l.unit_id);
    }
  });
  return rows;
}

export async function listInvoices(filter?: "all" | "unpaid" | "overdue" | "paid"): Promise<Invoice[]> {
  const supabase = await createClient();
  let q = supabase
    .from("invoice")
    .select(INVOICE_SELECT)
    .order("created_at", { ascending: false });

  if (filter === "unpaid")  q = q.in("status", ["unpaid", "overdue"]);
  if (filter === "overdue") q = q.eq("status", "overdue");
  if (filter === "paid")    q = q.eq("status", "paid");

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return enrich((data ?? []) as Invoice[]);
}

export async function getInvoice(id: string): Promise<Invoice | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoice")
    .select(INVOICE_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const [enriched] = await enrich([data as Invoice]);
  return enriched;
}

function logWriteError(fn: string, error: unknown) {
  const safe = error instanceof Error ? error.message : JSON.stringify(error, null, 2);
  // eslint-disable-next-line no-console
  console.error("[" + fn + "]", safe);
}

export async function createInvoice(input: InvoiceCreateInput): Promise<Invoice> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("invoice")
    .insert({
      lease_id: input.lease_id,
      type: input.type,
      amount: input.amount,
      due_date: input.due_date,
      status: "unpaid",
    })
    .select(INVOICE_SELECT)
    .single();
  if (error) { logWriteError("createInvoice", error); throw new Error(error.message); }
  return data as Invoice;
}

export async function markInvoicePaid(id: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("invoice").update({ status: "paid" }).eq("id", id);
  if (error) { logWriteError("markInvoicePaid", error); throw new Error(error.message); }
}

export async function voidInvoice(id: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("invoice").update({ status: "void" }).eq("id", id);
  if (error) { logWriteError("voidInvoice", error); throw new Error(error.message); }
}

export async function listOverdueInvoices(): Promise<Invoice[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoice")
    .select(INVOICE_SELECT)
    .eq("status", "unpaid")
    .lt("due_date", new Date().toISOString().slice(0, 10))
    .order("due_date", { ascending: true });
  if (error) throw new Error(error.message);
  return enrich((data ?? []) as Invoice[]);
}

export async function dashboardStats(): Promise<{
  outstanding: number;
  collected_this_month: number;
  overdue_count: number;
  due_this_week: number;
}> {
  const supabase = await createClient();
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const weekAhead = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const todayStr = today.toISOString().slice(0, 10);

  const [{ data: unpaid }, { data: paid }, { data: overdue }, { data: dueWeek }] = await Promise.all([
    supabase.from("invoice").select("amount").in("status", ["unpaid","overdue"]),
    supabase.from("payment").select("amount").gte("paid_at", monthStart),
    supabase.from("invoice").select("id").eq("status", "overdue"),
    supabase.from("invoice").select("id").in("status", ["unpaid","overdue"])
      .gte("due_date", todayStr).lte("due_date", weekAhead),
  ]);

  return {
    outstanding: (unpaid ?? []).reduce((s, r: any) => s + Number(r.amount), 0),
    collected_this_month: (paid ?? []).reduce((s, r: any) => s + Number(r.amount), 0),
    overdue_count: (overdue ?? []).length,
    due_this_week: (dueWeek ?? []).length,
  };
}
`;

// =============================================================================
// DB: payments
// =============================================================================

FILES["src/lib/db/payments.ts"] =
`import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PaymentCreateInput } from "@/lib/schemas/invoice";

export type Payment = {
  id: string;
  invoice_id: string;
  amount: number;
  method: string;
  reference_no: string | null;
  paid_at: string;
  recorded_by: string | null;
  receipt_number: string | null;
  invoice_display?: string;
  tenant_name?: string;
};

export async function listPayments(): Promise<Payment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payment")
    .select("id, invoice_id, amount, method, reference_no, paid_at, recorded_by, receipt_number")
    .order("paid_at", { ascending: false });
  if (error) throw new Error(error.message);

  const payments = (data ?? []) as Payment[];
  if (payments.length === 0) return payments;

  const invIds = Array.from(new Set(payments.map((p) => p.invoice_id)));
  const { data: invoices } = await supabase
    .from("invoice").select("id, display_number, lease_id").in("id", invIds);
  const invMap = new Map((invoices ?? []).map((i: any) => [i.id, i]));

  const leaseIds = Array.from(new Set((invoices ?? []).map((i: any) => i.lease_id)));
  const { data: leases } = leaseIds.length > 0
    ? await supabase.from("lease").select("id, tenant_id").in("id", leaseIds)
    : { data: [] as { id: string; tenant_id: string }[] };

  const tenantIds = Array.from(new Set((leases ?? []).map((l) => l.tenant_id)));
  const { data: tenants } = tenantIds.length > 0
    ? await supabase.from("tenant").select("id, full_name").in("id", tenantIds)
    : { data: [] as { id: string; full_name: string }[] };

  const lMap = new Map((leases ?? []).map((l) => [l.id, l]));
  const tMap = new Map((tenants ?? []).map((t) => [t.id, t.full_name]));

  payments.forEach((p) => {
    const inv = invMap.get(p.invoice_id);
    p.invoice_display = inv?.display_number ?? undefined;
    const l = inv ? lMap.get(inv.lease_id) : null;
    p.tenant_name = l ? tMap.get(l.tenant_id) : undefined;
  });

  return payments;
}

export async function listPaymentsForInvoice(invoice_id: string): Promise<Payment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payment")
    .select("id, invoice_id, amount, method, reference_no, paid_at, recorded_by, receipt_number")
    .eq("invoice_id", invoice_id)
    .order("paid_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Payment[];
}

export async function getPayment(id: string): Promise<Payment | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payment")
    .select("id, invoice_id, amount, method, reference_no, paid_at, recorded_by, receipt_number")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Payment) ?? null;
}

export async function recordPayment(
  input: PaymentCreateInput & { recorded_by: string | null }
): Promise<Payment> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("payment")
    .insert({
      invoice_id: input.invoice_id,
      amount: input.amount,
      method: input.method,
      reference_no: input.reference_no || null,
      recorded_by: input.recorded_by,
    })
    .select("id, invoice_id, amount, method, reference_no, paid_at, recorded_by, receipt_number")
    .single();
  if (error) {
    console.error("[recordPayment]", JSON.stringify(error, null, 2));
    throw new Error(error.message);
  }
  return data as Payment;
}
`;

// =============================================================================
// DB: deposits
// =============================================================================

FILES["src/lib/db/deposits.ts"] =
`import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type Deposit = {
  id: string;
  lease_id: string;
  amount: number;
  status: "held" | "partial" | "returned" | "forfeited";
  refunded_amount: number;
  tenant_name?: string;
  unit_number?: string;
};

export async function listDeposits(): Promise<Deposit[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deposit")
    .select("id, lease_id, amount, status, refunded_amount")
    .order("id", { ascending: false });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Deposit[];
  if (rows.length === 0) return rows;

  const leaseIds = Array.from(new Set(rows.map((d) => d.lease_id)));
  const { data: leases } = await supabase
    .from("lease").select("id, tenant_id, unit_id").in("id", leaseIds);

  const tenantIds = Array.from(new Set((leases ?? []).map((l) => l.tenant_id)));
  const unitIds   = Array.from(new Set((leases ?? []).map((l) => l.unit_id)));

  const [{ data: tenants }, { data: units }] = await Promise.all([
    tenantIds.length > 0
      ? supabase.from("tenant").select("id, full_name").in("id", tenantIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    unitIds.length > 0
      ? supabase.from("unit").select("id, unit_number").in("id", unitIds)
      : Promise.resolve({ data: [] as { id: string; unit_number: string }[] }),
  ]);

  const lMap = new Map((leases ?? []).map((l) => [l.id, l]));
  const tMap = new Map((tenants ?? []).map((t) => [t.id, t.full_name]));
  const uMap = new Map((units ?? []).map((u) => [u.id, u.unit_number]));

  rows.forEach((d) => {
    const l = lMap.get(d.lease_id);
    if (l) {
      d.tenant_name = tMap.get(l.tenant_id);
      d.unit_number = uMap.get(l.unit_id);
    }
  });
  return rows;
}

export async function refundDeposit(
  id: string,
  amount: number,
  forfeit: boolean
): Promise<void> {
  const admin = createAdminClient();
  const status = forfeit ? "forfeited" : amount === 0 ? "forfeited" : "returned";
  const { error } = await admin
    .from("deposit")
    .update({ status, refunded_amount: amount })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
`;

// =============================================================================
// DB: ledger
// =============================================================================

FILES["src/lib/db/ledger.ts"] =
`import "server-only";
import { createClient } from "@/lib/supabase/server";

export type LedgerEntry = {
  id: string;
  tenant_id: string;
  type: "debit" | "credit";
  amount: number;
  balance_after: number;
  ref_invoice_id: string | null;
  created_at: string;
};

export async function listLedgerForTenant(tenant_id: string): Promise<LedgerEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ledger_entry")
    .select("id, tenant_id, type, amount, balance_after, ref_invoice_id, created_at")
    .eq("tenant_id", tenant_id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as LedgerEntry[];
}

export async function appendLedgerEntry(input: {
  tenant_id: string;
  type: "debit" | "credit";
  amount: number;
  ref_invoice_id: string | null;
}): Promise<void> {
  const supabase = await createClient();
  // Get current balance
  const { data: last } = await supabase
    .from("ledger_entry")
    .select("balance_after")
    .eq("tenant_id", input.tenant_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const prev = last ? Number(last.balance_after) : 0;
  const delta = input.type === "debit" ? input.amount : -input.amount;
  const balance_after = prev + delta;

  const { error } = await supabase.from("ledger_entry").insert({
    tenant_id: input.tenant_id,
    type: input.type,
    amount: input.amount,
    balance_after,
    ref_invoice_id: input.ref_invoice_id,
  });
  if (error) throw new Error(error.message);
}
`;

// =============================================================================
// EMAIL
// =============================================================================

FILES["src/lib/email/send.ts"] =
`import "server-only";

type SendArgs = {
  to: string;
  subject: string;
  html: string;
};

export async function sendEmail({ to, subject, html }: SendArgs): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[sendEmail] RESEND_API_KEY not set — email skipped");
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: \`Bearer \${apiKey}\`,
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM ?? "Apartment Portal <noreply@example.com>",
        to,
        subject,
        html,
      }),
    });
    if (!res.ok) {
      console.error("[sendEmail] failed:", res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("[sendEmail] error:", err);
    return false;
  }
}
`;

FILES["src/lib/email/templates.ts"] =
`import "server-only";

export function receiptEmailHtml(input: {
  tenant_name: string;
  receipt_number: string;
  invoice_number: string | null;
  amount: string;
  method: string;
  paid_at: string;
  property_name: string;
  unit_number: string;
}): string {
  return \`<!DOCTYPE html>
<html>
<body style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #111;">
  <h2 style="color: #2b5797;">Payment Receipt</h2>
  <p>Hi \${input.tenant_name},</p>
  <p>Thank you for your payment. Details below:</p>
  <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
    <tr><td style="padding: 6px 0; color: #666;">Receipt No.</td><td style="text-align: right;"><strong>\${input.receipt_number}</strong></td></tr>
    <tr><td style="padding: 6px 0; color: #666;">Invoice No.</td><td style="text-align: right;">\${input.invoice_number ?? "—"}</td></tr>
    <tr><td style="padding: 6px 0; color: #666;">Property</td><td style="text-align: right;">\${input.property_name}</td></tr>
    <tr><td style="padding: 6px 0; color: #666;">Unit</td><td style="text-align: right;">\${input.unit_number}</td></tr>
    <tr><td style="padding: 6px 0; color: #666;">Method</td><td style="text-align: right;">\${input.method}</td></tr>
    <tr><td style="padding: 6px 0; color: #666;">Date</td><td style="text-align: right;">\${input.paid_at}</td></tr>
    <tr style="border-top: 2px solid #2b5797;"><td style="padding: 12px 0; font-weight: 600;">Amount paid</td><td style="padding: 12px 0; text-align: right; font-weight: 700; color: #1e7a3a;">\${input.amount}</td></tr>
  </table>
  <p style="color: #666; font-size: 13px;">This is an automated receipt. Please keep it for your records.</p>
</body>
</html>\`;
}
`;

// =============================================================================
// PAGES — Accounting dashboard
// =============================================================================

FILES["src/app/(dashboard)/accounting/page.tsx"] =
`import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/guard";
import { dashboardStats } from "@/lib/db/invoices";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatPHP } from "@/lib/utils/format-php";

export default async function AccountingHome() {
  await requirePagePermission("invoice:read");
  const stats = await dashboardStats();

  return (
    <div>
      <PageHeader
        title="Accounting"
        description="Invoices, payments, deposits, and ledger."
        action={
          <div className="flex gap-2">
            <Link href="/accounting/invoices/new"><Button>+ New Invoice</Button></Link>
            <Link href="/accounting/approvals"><Button variant="secondary">Approvals</Button></Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Stat label="Outstanding" value={formatPHP(stats.outstanding)} tone="text-gray-900" />
        <Stat label="Collected this month" value={formatPHP(stats.collected_this_month)} tone="text-green-700" />
        <Stat label="Overdue invoices" value={String(stats.overdue_count)} tone="text-red-600" />
        <Stat label="Due this week" value={String(stats.due_this_week)} tone="text-yellow-700" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <QuickCard href="/accounting/invoices" title="Invoices" desc="All invoices, filterable by status." />
        <QuickCard href="/accounting/payments" title="Payments" desc="Recorded payments with receipts." />
        <QuickCard href="/accounting/deposits" title="Deposits" desc="Held, refunded, and forfeited deposits." />
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <Card>
      <CardBody>
        <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
        <p className={"text-2xl font-semibold mt-1 " + tone}>{value}</p>
      </CardBody>
    </Card>
  );
}

function QuickCard({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link href={href} className="block">
      <Card className="hover:border-brand-500 transition-colors">
        <CardBody>
          <p className="font-medium text-brand-600">{title}</p>
          <p className="text-sm text-gray-500 mt-1">{desc}</p>
        </CardBody>
      </Card>
    </Link>
  );
}
`;

// =============================================================================
// PAGES — Invoices list
// =============================================================================

FILES["src/app/(dashboard)/accounting/invoices/page.tsx"] =
`import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/guard";
import { listInvoices } from "@/lib/db/invoices";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { InvoiceTable } from "@/components/accounting/invoice-table";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  await requirePagePermission("invoice:read");
  const sp = await searchParams;
  const filter = (sp.filter as "all" | "unpaid" | "overdue" | "paid") ?? "all";
  const invoices = await listInvoices(filter);

  const tabs = [
    { key: "all", label: "All" },
    { key: "unpaid", label: "Unpaid" },
    { key: "overdue", label: "Overdue" },
    { key: "paid", label: "Paid" },
  ];

  return (
    <div>
      <PageHeader
        title="Invoices"
        description="All invoices with status filters."
        action={<Link href="/accounting/invoices/new"><Button>+ New Invoice</Button></Link>}
      />

      <div className="flex gap-2 mb-4">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={\`/accounting/invoices?filter=\${t.key}\`}
            className={
              "px-3 py-1.5 rounded text-sm " +
              (filter === t.key
                ? "bg-brand-500 text-white"
                : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50")
            }
          >
            {t.label}
          </Link>
        ))}
      </div>

      {invoices.length === 0 ? (
        <EmptyState
          title="No invoices"
          description="Create an invoice or wait for lease signing to auto-generate one."
        />
      ) : (
        <InvoiceTable invoices={invoices} />
      )}
    </div>
  );
}
`;

FILES["src/app/(dashboard)/accounting/invoices/new/page.tsx"] =
`import { requirePagePermission } from "@/lib/auth/guard";
import { listLeases } from "@/lib/db/leases";
import { PageHeader } from "@/components/layout/page-header";
import { InvoiceForm } from "@/components/accounting/invoice-form";

export default async function NewInvoicePage() {
  await requirePagePermission("invoice:create");
  const leases = await listLeases();
  return (
    <div>
      <PageHeader title="New Invoice" description="Create a manual invoice." />
      <InvoiceForm leases={leases} />
    </div>
  );
}
`;

FILES["src/app/(dashboard)/accounting/invoices/[id]/page.tsx"] =
`import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/guard";
import { getInvoice } from "@/lib/db/invoices";
import { listPaymentsForInvoice } from "@/lib/db/payments";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { formatPHP } from "@/lib/utils/format-php";
import { PaymentForm } from "@/components/accounting/payment-form";
import { VoidInvoiceButton } from "@/components/accounting/void-invoice-button";

const STATUS_TONE: Record<string, "gray" | "green" | "yellow" | "red"> = {
  unpaid: "yellow", paid: "green", overdue: "red", void: "gray",
};

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("invoice:read");
  const { id } = await params;
  const invoice = await getInvoice(id);
  if (!invoice) notFound();
  const payments = await listPaymentsForInvoice(id);

  const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div>
      <PageHeader
        title={invoice.display_number ?? "Invoice"}
        description={
          (invoice.tenant_name ?? "") +
          (invoice.unit_number ? " · Unit " + invoice.unit_number : "")
        }
        action={<Badge tone={STATUS_TONE[invoice.status] ?? "gray"}>{invoice.status}</Badge>}
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader title="Details" />
            <CardBody className="text-sm space-y-2">
              <Row label="Type" value={invoice.type} />
              <Row label="Amount" value={formatPHP(invoice.amount)} />
              <Row label="Paid so far" value={formatPHP(totalPaid)} />
              <Row label="Due date" value={invoice.due_date} />
              <Row label="Status" value={invoice.status} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Payments" description={payments.length + " recorded"} />
            <CardBody>
              {payments.length === 0 ? (
                <p className="text-sm text-gray-500">No payments yet.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {payments.map((p) => (
                    <li key={p.id} className="flex justify-between border-b border-gray-100 pb-2">
                      <span>
                        {formatPHP(p.amount)} · {p.method}
                        {p.receipt_number ? " · " + p.receipt_number : ""}
                      </span>
                      <Link
                        href={"/accounting/payments/" + p.id + "/receipt"}
                        className="text-brand-600 hover:underline text-xs"
                      >
                        Receipt
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          {invoice.status !== "paid" && invoice.status !== "void" && (
            <PaymentForm invoiceId={invoice.id} remaining={Number(invoice.amount) - totalPaid} />
          )}
          {invoice.status !== "void" && (
            <VoidInvoiceButton id={invoice.id} />
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium capitalize">{value}</span>
    </div>
  );
}
`;

// =============================================================================
// PAGES — Payments
// =============================================================================

FILES["src/app/(dashboard)/accounting/payments/page.tsx"] =
`import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/guard";
import { listPayments } from "@/lib/db/payments";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { formatPHP } from "@/lib/utils/format-php";

export default async function PaymentsPage() {
  await requirePagePermission("payment:read");
  const payments = await listPayments();

  return (
    <div>
      <PageHeader
        title="Payments"
        description="All recorded payments with printable receipts."
      />
      {payments.length === 0 ? (
        <EmptyState
          title="No payments yet"
          description="Record payments from the invoice detail page."
        />
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <Table>
            <THead>
              <TR>
                <TH>Receipt</TH><TH>Invoice</TH><TH>Tenant</TH>
                <TH className="text-right">Amount</TH><TH>Method</TH><TH>Paid at</TH>
                <TH className="text-right"></TH>
              </TR>
            </THead>
            <TBody>
              {payments.map((p) => (
                <TR key={p.id}>
                  <TD className="font-medium">{p.receipt_number ?? "—"}</TD>
                  <TD>{p.invoice_display ?? "—"}</TD>
                  <TD className="text-gray-600">{p.tenant_name ?? "—"}</TD>
                  <TD className="text-right">{formatPHP(p.amount)}</TD>
                  <TD className="text-gray-600">{p.method}</TD>
                  <TD className="text-gray-600 text-xs">
                    {new Date(p.paid_at).toLocaleString("en-PH")}
                  </TD>
                  <TD className="text-right">
                    <Link
                      href={"/accounting/payments/" + p.id + "/receipt"}
                      className="text-brand-600 hover:underline text-sm"
                    >
                      Receipt
                    </Link>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}
    </div>
  );
}
`;

FILES["src/app/(dashboard)/accounting/payments/[id]/receipt/page.tsx"] =
`import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/guard";
import { getPayment } from "@/lib/db/payments";
import { getInvoice } from "@/lib/db/invoices";
import { getLease } from "@/lib/db/leases";
import { getTenant } from "@/lib/db/tenants";
import { getUnit } from "@/lib/db/units";
import { getProperty } from "@/lib/db/properties";
import { formatPHP } from "@/lib/utils/format-php";
import { PrintButton } from "@/components/accounting/print-button";

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("payment:read");
  const { id } = await params;
  const payment = await getPayment(id);
  if (!payment) notFound();

  const invoice = await getInvoice(payment.invoice_id);
  const lease = invoice ? await getLease(invoice.lease_id) : null;
  const tenant = lease ? await getTenant(lease.tenant_id) : null;
  const unit = lease ? await getUnit(lease.unit_id) : null;
  const property = unit ? await getProperty(unit.property_id) : null;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-4 flex justify-end">
        <PrintButton />
      </div>
      <div className="bg-white border border-gray-200 rounded-lg p-10">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-brand-600">Payment Receipt</h1>
          <p className="text-sm text-gray-500 mt-1">{payment.receipt_number}</p>
        </div>

        <div className="text-sm space-y-3">
          <Row label="Received from" value={tenant?.full_name ?? "—"} />
          <Row label="Property" value={property?.name ?? "—"} />
          <Row label="Unit" value={unit?.unit_number ?? "—"} />
          <Row label="Invoice" value={invoice?.display_number ?? "—"} />
          <Row label="Method" value={payment.method} />
          {payment.reference_no && <Row label="Reference" value={payment.reference_no} />}
          <Row label="Paid at" value={new Date(payment.paid_at).toLocaleString("en-PH")} />
        </div>

        <div className="border-t-2 border-brand-500 mt-8 pt-4">
          <div className="flex justify-between items-center text-lg">
            <span className="font-medium">Amount paid</span>
            <span className="font-bold text-green-700">{formatPHP(payment.amount)}</span>
          </div>
        </div>

        <p className="text-xs text-gray-500 text-center mt-10">
          This is an automated receipt. Please keep it for your records.
        </p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
`;

// =============================================================================
// PAGES — Deposits
// =============================================================================

FILES["src/app/(dashboard)/accounting/deposits/page.tsx"] =
`import { requirePagePermission } from "@/lib/auth/guard";
import { listDeposits } from "@/lib/db/deposits";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { DepositTable } from "@/components/accounting/deposit-table";

export default async function DepositsPage() {
  await requirePagePermission("deposit:read");
  const deposits = await listDeposits();
  return (
    <div>
      <PageHeader
        title="Deposits"
        description="Security deposits held, refunded, or forfeited."
      />
      {deposits.length === 0 ? (
        <EmptyState
          title="No deposits"
          description="Deposits are created automatically when a lease is signed."
        />
      ) : (
        <DepositTable deposits={deposits} />
      )}
    </div>
  );
}
`;

// =============================================================================
// COMPONENTS
// =============================================================================

FILES["src/components/accounting/invoice-table.tsx"] =
`import Link from "next/link";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatPHP } from "@/lib/utils/format-php";
import type { Invoice } from "@/lib/db/invoices";

const STATUS_TONE: Record<string, "gray" | "green" | "yellow" | "red"> = {
  unpaid: "yellow", paid: "green", overdue: "red", void: "gray",
};

export function InvoiceTable({ invoices }: { invoices: Invoice[] }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <Table>
        <THead>
          <TR>
            <TH>Invoice</TH><TH>Tenant</TH><TH>Unit</TH><TH>Type</TH>
            <TH className="text-right">Amount</TH><TH>Due</TH><TH>Status</TH>
          </TR>
        </THead>
        <TBody>
          {invoices.map((inv) => (
            <TR key={inv.id}>
              <TD className="font-medium">
                <Link href={"/accounting/invoices/" + inv.id} className="text-brand-600 hover:underline">
                  {inv.display_number ?? inv.id.slice(0, 8)}
                </Link>
              </TD>
              <TD className="text-gray-600">{inv.tenant_name ?? "—"}</TD>
              <TD className="text-gray-600">{inv.unit_number ?? "—"}</TD>
              <TD className="capitalize text-gray-600">{inv.type}</TD>
              <TD className="text-right">{formatPHP(inv.amount)}</TD>
              <TD className="text-xs text-gray-600">{inv.due_date}</TD>
              <TD><Badge tone={STATUS_TONE[inv.status] ?? "gray"}>{inv.status}</Badge></TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
`;

FILES["src/components/accounting/invoice-form.tsx"] =
`"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { createInvoiceAction } from "@/app/(dashboard)/accounting/invoices/actions";
import type { ActionResult } from "@/lib/actions/result";
import type { Lease } from "@/lib/db/leases";

const TYPES = [
  { value: "rent",    label: "Rent" },
  { value: "deposit", label: "Deposit" },
  { value: "penalty", label: "Penalty" },
  { value: "other",   label: "Other" },
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" loading={pending}>Create Invoice</Button>;
}

export function InvoiceForm({ leases }: { leases: Lease[] }) {
  const router = useRouter();
  const toast = useToast();
  const [state, formAction] = useActionState<ActionResult | null, FormData>(createInvoiceAction, null);

  useEffect(() => {
    if (state?.ok) toast.push("Invoice created", "success");
    else if (state && !state.ok) toast.push(state.error, "error");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const fieldError = (k: string) => (state && !state.ok ? state.fieldErrors?.[k] : undefined);

  const leaseOptions = leases.map((l) => ({
    value: l.id,
    label: (l.unit_number ?? "Unit ?") + " — " + (l.tenant_name ?? "Tenant ?"),
  }));

  return (
    <Card className="max-w-2xl">
      <CardBody>
        <form action={formAction} className="space-y-4">
          <Select
            name="lease_id" label="Lease" options={leaseOptions} placeholder="Select a lease"
            error={fieldError("lease_id")} required
          />
          <Select
            name="type" label="Type" options={TYPES} defaultValue="rent" error={fieldError("type")}
          />
          <Input
            name="amount" label="Amount (PHP)" type="number" step="0.01" min={0.01}
            error={fieldError("amount")} required
          />
          <Input
            name="due_date" label="Due date" type="date"
            error={fieldError("due_date")} required
          />
          <div className="flex items-center gap-3 pt-2">
            <SubmitButton />
            <Button type="button" variant="secondary" onClick={() => router.push("/accounting/invoices")}>
              Cancel
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
`;

FILES["src/components/accounting/payment-form.tsx"] =
`"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { recordPaymentAction } from "@/app/(dashboard)/accounting/invoices/actions";
import type { ActionResult } from "@/lib/actions/result";
import { formatPHP } from "@/lib/utils/format-php";

const METHODS = [
  { value: "cash",          label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "gcash",         label: "GCash" },
  { value: "maya",          label: "Maya" },
  { value: "check",         label: "Check" },
  { value: "other",         label: "Other" },
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" loading={pending}>Record Payment</Button>;
}

export function PaymentForm({
  invoiceId,
  remaining,
}: {
  invoiceId: string;
  remaining: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [state, formAction] = useActionState<ActionResult | null, FormData>(recordPaymentAction, null);

  useEffect(() => {
    if (state?.ok) {
      toast.push("Payment recorded", "success");
      router.refresh();
    } else if (state && !state.ok) {
      toast.push(state.error, "error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const fieldError = (k: string) => (state && !state.ok ? state.fieldErrors?.[k] : undefined);

  return (
    <Card>
      <CardHeader
        title="Record Payment"
        description={"Remaining: " + formatPHP(remaining)}
      />
      <CardBody>
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="invoice_id" value={invoiceId} />
          <Input
            name="amount" label="Amount" type="number" step="0.01" min={0.01}
            defaultValue={remaining}
            error={fieldError("amount")} required
          />
          <Select name="method" label="Method" options={METHODS} defaultValue="cash" />
          <Input name="reference_no" label="Reference #" hint="Optional" />
          <SubmitButton />
        </form>
      </CardBody>
    </Card>
  );
}
`;

FILES["src/components/accounting/void-invoice-button.tsx"] =
`"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { voidInvoiceAction } from "@/app/(dashboard)/accounting/invoices/actions";

export function VoidInvoiceButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const toast = useToast();

  function onClick() {
    if (!confirming) { setConfirming(true); return; }
    start(async () => {
      try {
        await voidInvoiceAction(id);
        toast.push("Invoice voided", "success");
      } catch { toast.push("Failed to void", "error"); }
    });
  }

  return (
    <Button variant={confirming ? "danger" : "secondary"} onClick={onClick} loading={pending}>
      {confirming ? "Click again to void" : "Void Invoice"}
    </Button>
  );
}
`;

FILES["src/components/accounting/deposit-table.tsx"] =
`"use client";

import { useState, useTransition } from "react";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { formatPHP } from "@/lib/utils/format-php";
import { refundDepositAction } from "@/app/(dashboard)/accounting/actions";
import type { Deposit } from "@/lib/db/deposits";

const STATUS_TONE: Record<string, "yellow" | "blue" | "green" | "red"> = {
  held: "yellow", partial: "blue", returned: "green", forfeited: "red",
};

export function DepositTable({ deposits }: { deposits: Deposit[] }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <Table>
        <THead>
          <TR>
            <TH>Tenant</TH><TH>Unit</TH>
            <TH className="text-right">Held</TH>
            <TH className="text-right">Refunded</TH>
            <TH>Status</TH>
            <TH className="text-right">Action</TH>
          </TR>
        </THead>
        <TBody>
          {deposits.map((d) => <DepositRow key={d.id} deposit={d} />)}
        </TBody>
      </Table>
    </div>
  );
}

function DepositRow({ deposit }: { deposit: Deposit }) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(deposit.amount));
  const [forfeit, setForfeit] = useState(false);
  const toast = useToast();

  const canAct = deposit.status === "held" || deposit.status === "partial";

  function submit() {
    start(async () => {
      try {
        await refundDepositAction(deposit.id, Number(amount), forfeit);
        toast.push("Deposit settled", "success");
        setOpen(false);
      } catch { toast.push("Failed", "error"); }
    });
  }

  return (
    <>
      <TR>
        <TD className="font-medium">{deposit.tenant_name ?? "—"}</TD>
        <TD className="text-gray-600">{deposit.unit_number ?? "—"}</TD>
        <TD className="text-right">{formatPHP(deposit.amount)}</TD>
        <TD className="text-right">{formatPHP(deposit.refunded_amount)}</TD>
        <TD><Badge tone={STATUS_TONE[deposit.status] ?? "gray"}>{deposit.status}</Badge></TD>
        <TD className="text-right">
          {canAct && (
            <Button size="sm" variant="secondary" onClick={() => setOpen((v) => !v)}>
              {open ? "Cancel" : "Settle"}
            </Button>
          )}
        </TD>
      </TR>
      {open && (
        <TR>
          <TD colSpan={6}>
            <div className="bg-gray-50 rounded p-3 space-y-2">
              <div className="flex items-center gap-3 text-sm">
                <label className="flex items-center gap-1">
                  <input type="checkbox" checked={forfeit} onChange={(e) => setForfeit(e.target.checked)} />
                  Forfeit (no refund)
                </label>
                {!forfeit && (
                  <input
                    type="number" step="0.01" min={0}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="border border-gray-300 rounded px-2 py-1 text-sm w-40"
                  />
                )}
                <Button size="sm" onClick={submit} loading={pending}>Confirm</Button>
              </div>
            </div>
          </TD>
        </TR>
      )}
    </>
  );
}
`;

FILES["src/components/accounting/print-button.tsx"] =
`"use client";

import { Button } from "@/components/ui/button";

export function PrintButton() {
  return <Button variant="secondary" onClick={() => window.print()}>Print / Save as PDF</Button>;
}
`;

// =============================================================================
// ACTIONS
// =============================================================================

FILES["src/app/(dashboard)/accounting/invoices/actions.ts"] =
`"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertPermission } from "@/lib/auth/guard";
import { getSession } from "@/lib/auth/get-session";
import { createInvoice, markInvoicePaid, voidInvoice } from "@/lib/db/invoices";
import { recordPayment } from "@/lib/db/payments";
import { appendLedgerEntry } from "@/lib/db/ledger";
import { logAudit } from "@/lib/audit/log";
import { emit } from "@/lib/events/emit";
import { invoiceCreateSchema, paymentCreateSchema } from "@/lib/schemas/invoice";
import { parseForm } from "@/lib/forms/parse";
import type { ActionResult } from "@/lib/actions/result";

export async function createInvoiceAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await assertPermission("invoice:create");
  const parsed = parseForm(invoiceCreateSchema, formData);
  if (!parsed.ok) return { ok: false, error: parsed.error, fieldErrors: parsed.fieldErrors };

  const session = await getSession();
  const invoice = await createInvoice(parsed.data);

  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "invoice",
    entity_id: invoice.id,
    action: "create",
    after: invoice,
  });

  await emit("invoice.created", { invoice_id: invoice.id }, session?.id ?? null);

  revalidatePath("/accounting/invoices");
  redirect("/accounting/invoices/" + invoice.id);
}

export async function recordPaymentAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await assertPermission("payment:create");
  const parsed = parseForm(paymentCreateSchema, formData);
  if (!parsed.ok) return { ok: false, error: parsed.error, fieldErrors: parsed.fieldErrors };

  const session = await getSession();
  const payment = await recordPayment({ ...parsed.data, recorded_by: session?.id ?? null });

  // Mark invoice paid (V1: single payment per invoice)
  await markInvoicePaid(payment.invoice_id);

  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "payment",
    entity_id: payment.id,
    action: "create",
    after: payment,
  });

  await emit("invoice.paid", {
    payment_id: payment.id,
    invoice_id: payment.invoice_id,
    amount: payment.amount,
  }, session?.id ?? null);

  revalidatePath("/accounting/invoices/" + payment.invoice_id);
  revalidatePath("/accounting/payments");
  return { ok: true, data: undefined };
}

export async function voidInvoiceAction(id: string): Promise<void> {
  await assertPermission("invoice:void");
  const session = await getSession();
  await voidInvoice(id);
  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "invoice",
    entity_id: id,
    action: "archive",
    reason: "voided",
  });
  revalidatePath("/accounting/invoices");
  revalidatePath("/accounting/invoices/" + id);
}
`;

FILES["src/app/(dashboard)/accounting/actions.ts"] =
`"use server";

import { revalidatePath } from "next/cache";
import { assertPermission } from "@/lib/auth/guard";
import { getSession } from "@/lib/auth/get-session";
import { refundDeposit } from "@/lib/db/deposits";
import { logAudit } from "@/lib/audit/log";
import { emit } from "@/lib/events/emit";

export async function refundDepositAction(
  id: string,
  amount: number,
  forfeit: boolean
) {
  await assertPermission("deposit:refund");
  const session = await getSession();

  await refundDeposit(id, amount, forfeit);

  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "deposit",
    entity_id: id,
    action: "update",
    after: { refunded_amount: amount, forfeited: forfeit },
  });

  await emit("deposit.refunded", { deposit_id: id, amount, forfeit }, session?.id ?? null);

  revalidatePath("/accounting/deposits");
}
`;

// =============================================================================
// EVENT CONSUMERS — extend registry
// =============================================================================

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
  if (!lease) { console.error("[lease.signed] lease not found"); return; }

  // Mark lease active + unit occupied
  await admin.from("lease").update({ status: "active" }).eq("id", lease.id);
  await admin.from("unit").update({ status: "occupied" }).eq("id", lease.unit_id);

  // Create deposit invoice if deposit_amount > 0
  if (Number(lease.deposit_amount) > 0) {
    await admin.from("invoice").insert({
      lease_id: lease.id,
      type: "deposit",
      amount: lease.deposit_amount,
      due_date: lease.start_date,
      status: "unpaid",
    });

    // Record deposit as held
    await admin.from("deposit").insert({
      lease_id: lease.id,
      amount: lease.deposit_amount,
      status: "held",
      refunded_amount: 0,
    });
  }

  // Create first month's rent invoice
  await admin.from("invoice").insert({
    lease_id: lease.id,
    type: "rent",
    amount: lease.monthly_rent,
    due_date: lease.start_date,
    status: "unpaid",
  });

  console.log("[lease.signed] processed + invoices generated:", lease.id);
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

  // Get invoice -> lease -> tenant
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

  // Append ledger credit
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

  console.log("[invoice.paid] ledger updated for tenant:", lease.tenant_id);
}
`;

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
// CRON — overdue invoice marking
// =============================================================================

FILES["src/app/api/cron/invoice-overdue/route.ts"] =
`import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emit } from "@/lib/events/emit";

// Call via Vercel Cron or manually to flip unpaid invoices past due → overdue
export async function GET() {
  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: unpaid } = await admin
    .from("invoice")
    .select("id")
    .eq("status", "unpaid")
    .lt("due_date", today);

  let flipped = 0;
  for (const inv of unpaid ?? []) {
    const { error } = await admin.from("invoice").update({ status: "overdue" }).eq("id", inv.id);
    if (!error) {
      await emit("invoice.overdue", { invoice_id: inv.id }, null);
      flipped++;
    }
  }

  return NextResponse.json({ flipped });
}

export async function POST() { return GET(); }
`;

// =============================================================================
// SIDEBAR UPDATE
// =============================================================================

FILES["src/components/shell/sidebar.tsx"] =
`import Link from "next/link";
import type { UserRole } from "@/lib/auth/get-user-roles";

type NavItem = { href: string; label: string; roles: string[] };
type NavGroup = { label: string; roles: string[]; items: NavItem[] };

const GROUPS: NavGroup[] = [
  { label: "Overview", roles: ["*"],
    items: [{ href: "/dashboard", label: "Dashboard", roles: ["*"] }] },
  { label: "Property",
    roles: ["property_rep", "executive", "marketing", "maintenance"],
    items: [
      { href: "/property/properties", label: "Properties", roles: ["property_rep", "executive"] },
      { href: "/property/units",      label: "Units",      roles: ["property_rep", "executive", "marketing", "maintenance"] },
      { href: "/property/tenants",    label: "Tenants",    roles: ["property_rep", "executive"] },
      { href: "/property/leases",     label: "Leases",     roles: ["property_rep", "executive"] },
      { href: "/property/contracts",  label: "Contracts",  roles: ["property_rep", "executive"] },
      { href: "/property/templates",  label: "Templates",  roles: ["property_rep", "executive"] },
    ] },
  { label: "Accounting", roles: ["accounting", "executive"],
    items: [
      { href: "/accounting",           label: "Overview",  roles: ["accounting", "executive"] },
      { href: "/accounting/invoices",  label: "Invoices",  roles: ["accounting", "executive"] },
      { href: "/accounting/payments",  label: "Payments",  roles: ["accounting", "executive"] },
      { href: "/accounting/deposits",  label: "Deposits",  roles: ["accounting", "executive"] },
      { href: "/accounting/approvals", label: "Approvals", roles: ["accounting", "executive"] },
    ] },
  { label: "Maintenance", roles: ["maintenance", "executive", "property_rep"],
    items: [
      { href: "/maintenance",                label: "Job Orders",    roles: ["maintenance", "executive", "property_rep"] },
      { href: "/maintenance/job-orders/new", label: "New Job Order", roles: ["maintenance", "property_rep"] },
      { href: "/maintenance/assets",         label: "Assets",        roles: ["maintenance", "executive"] },
      { href: "/maintenance/task-types",     label: "Task Types",    roles: ["executive"] },
    ] },
  { label: "Marketing", roles: ["marketing", "executive"],
    items: [{ href: "/marketing", label: "Marketing", roles: ["marketing", "executive"] }] },
  { label: "Admin", roles: ["executive", "system_admin"],
    items: [
      { href: "/executive", label: "Executive",    roles: ["executive"] },
      { href: "/admin",     label: "System Admin", roles: ["system_admin"] },
    ] },
];

export function Sidebar({ roles }: { roles: UserRole[] }) {
  const keys = roles.map((r) => r.role_key);
  const visibleGroups: NavGroup[] = GROUPS.map((g) => {
    if (!g.roles.includes("*") && !g.roles.some((r) => keys.includes(r))) return null;
    const items = g.items.filter(
      (item) => item.roles.includes("*") || item.roles.some((r) => keys.includes(r))
    );
    if (items.length === 0) return null;
    return { ...g, items };
  }).filter((g): g is NavGroup => g !== null);

  return (
    <aside className="w-60 bg-white border-r border-gray-200 flex flex-col">
      <div className="h-14 flex items-center px-4 border-b border-gray-200">
        <span className="font-semibold text-brand-500">Apartment Portal</span>
      </div>
      <nav className="flex-1 overflow-y-auto p-2 space-y-4">
        {visibleGroups.map((g) => (
          <div key={g.label}>
            <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
              {g.label}
            </p>
            {g.items.map((item) => (
              <Link key={item.href} href={item.href}
                className="block px-3 py-1.5 rounded text-sm text-gray-700 hover:bg-gray-100">
                {item.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
`;

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------
async function main() {
  const pkg = join(ROOT, "package.json");
  if (!(await exists(pkg))) {
    console.error("package.json not found. Run from project root.");
    process.exit(1);
  }
  console.log("Phase 3 - Accounting module\\n");
  let count = 0;
  for (const [relPath, content] of Object.entries(FILES)) {
    const full = join(ROOT, relPath);
    const exists_ = await exists(full);
    console.log((exists_ ? "  ~ " : "  + ") + relPath);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, content, "utf8");
    count++;
  }
  console.log("\\nDone - " + count + " file(s) written.\\n");
  console.log("Next:");
  console.log("  1. Run the 019_accounting_extras.sql migration in Supabase SQL Editor");
  console.log("  2. npm run typecheck");
  console.log("  3. npm run dev");
  console.log("\\nOptional (email receipts):");
  console.log("  - Sign up at resend.com");
  console.log("  - Add RESEND_API_KEY=... and RESEND_FROM=... to .env.local");
  console.log("\\nTest:");
  console.log("  http://localhost:3000/accounting");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});