import "server-only";
import { createClient } from "@/lib/supabase/server";

export type SpreadsheetRow = {
  lease_id: string;
  unit_id: string;
  unit_number: string | null;
  tenant_id: string;
  tenant_name: string | null;
  tenant_phone: string | null;
  lease_status: string;
  start_date: string;
  end_date: string;
  monthly_rent: number;
  deposit_1: number;
  deposit_2: number;
  // computed
  invoiced_month: number;
  paid_month: number;
  balance: number;
  last_payment_date: string | null;
  overdue: number;
  utility_balance: number;
};

export type SpreadsheetResult = {
  rows: SpreadsheetRow[];
  totals: {
    monthly_rent: number;
    deposit_1: number;
    deposit_2: number;
    invoiced_month: number;
    paid_month: number;
    balance: number;
    overdue: number;
    utility_balance: number;
  };
};

/**
 * Fetch the spreadsheet for one property and month.
 * month format: "YYYY-MM"
 */
export async function getSpreadsheetRows(
  property_id: string,
  month: string
): Promise<SpreadsheetResult> {
  const supabase = await createClient();

  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const mo = Number(monthStr);
  const monthStart = new Date(Date.UTC(year, mo - 1, 1)).toISOString().slice(0, 10);
  const monthEnd = new Date(Date.UTC(year, mo, 0)).toISOString().slice(0, 10);

  // 1. Units in this property
  const { data: units } = await supabase
    .from("unit")
    .select("id, unit_number")
    .eq("property_id", property_id)
    .order("unit_number");
  const unitRows = (units ?? []) as { id: string; unit_number: string }[];
  const unitIds = unitRows.map((u) => u.id);
  const unitMap = new Map(unitRows.map((u) => [u.id, u.unit_number]));

  if (unitIds.length === 0) {
    return { rows: [], totals: emptyTotals() };
  }

  // 2. Active leases on those units
  const { data: leases } = await supabase
    .from("lease")
    .select(
      "id, unit_id, tenant_id, start_date, end_date, monthly_rent, deposit_1, deposit_2, status"
    )
    .in("unit_id", unitIds)
    .eq("status", "active");

  const leaseRows = (leases ?? []) as {
    id: string;
    unit_id: string;
    tenant_id: string;
    start_date: string;
    end_date: string;
    monthly_rent: number;
    deposit_1: number | null;
    deposit_2: number | null;
    status: string;
  }[];

  if (leaseRows.length === 0) {
    return { rows: [], totals: emptyTotals() };
  }

  const leaseIds = leaseRows.map((l) => l.id);
  const tenantIds = Array.from(new Set(leaseRows.map((l) => l.tenant_id)));

  // 3. Tenants
  const { data: tenants } = await supabase
    .from("tenant")
    .select("id, full_name, phone")
    .in("id", tenantIds);
  const tenantMap = new Map(
    ((tenants ?? []) as { id: string; full_name: string | null; phone: string | null }[]).map(
      (t) => [t.id, t]
    )
  );

  // 4. Invoices for those leases
  const { data: invoices } = await supabase
    .schema("acct")
    .from("invoice")
    .select("id, lease_id, type, amount, due_date, status")
    .in("lease_id", leaseIds);

  const invoiceRows = (invoices ?? []) as {
    id: string;
    lease_id: string;
    type: string;
    amount: number;
    due_date: string;
    status: string;
  }[];

  const invoiceIds = invoiceRows.map((i) => i.id);
  const invoiceToLease = new Map(invoiceRows.map((i) => [i.id, i.lease_id]));

  // 5. Payments on those invoices
  let paymentRows: { id: string; invoice_id: string; amount: number; paid_at: string }[] = [];
  if (invoiceIds.length > 0) {
    const { data: payments } = await supabase
      .schema("acct")
      .from("payment")
      .select("id, invoice_id, amount, paid_at")
      .in("invoice_id", invoiceIds);
    paymentRows = (payments ?? []) as typeof paymentRows;
  }

  // ---- aggregate per lease ----
  const UTILITY_TYPES = new Set(["utility", "electricity", "water", "gas"]);

  const perLease = new Map<
    string,
    {
      invoiced_month: number;
      paid_month: number;
      balance: number;
      overdue: number;
      utility_balance: number;
      last_payment_date: string | null;
    }
  >();

  for (const l of leaseRows) {
    perLease.set(l.id, {
      invoiced_month: 0,
      paid_month: 0,
      balance: 0,
      overdue: 0,
      utility_balance: 0,
      last_payment_date: null,
    });
  }

  // Invoiced this month + balance + overdue + utility_balance
  for (const inv of invoiceRows) {
    const agg = perLease.get(inv.lease_id);
    if (!agg) continue;
    const due = inv.due_date.slice(0, 10);
    const amt = Number(inv.amount ?? 0);

    if (due >= monthStart && due <= monthEnd) {
      agg.invoiced_month += amt;
    }
    if (inv.status === "unpaid" || inv.status === "overdue") {
      agg.balance += amt;
    }
    if (inv.status === "overdue") {
      agg.overdue += amt;
    }
    if (
      (inv.status === "unpaid" || inv.status === "overdue") &&
      UTILITY_TYPES.has(inv.type)
    ) {
      agg.utility_balance += amt;
    }
  }

  // Paid this month + last payment
  for (const p of paymentRows) {
    const leaseId = invoiceToLease.get(p.invoice_id);
    if (!leaseId) continue;
    const agg = perLease.get(leaseId);
    if (!agg) continue;
    const paidDay = (p.paid_at ?? "").slice(0, 10);
    const amt = Number(p.amount ?? 0);

    if (paidDay >= monthStart && paidDay <= monthEnd) {
      agg.paid_month += amt;
    }
    if (!agg.last_payment_date || paidDay > agg.last_payment_date) {
      agg.last_payment_date = paidDay || null;
    }
  }

  // ---- build rows ----
  const rows: SpreadsheetRow[] = leaseRows.map((l) => {
    const t = tenantMap.get(l.tenant_id);
    const agg = perLease.get(l.id)!;
    return {
      lease_id: l.id,
      unit_id: l.unit_id,
      unit_number: unitMap.get(l.unit_id) ?? null,
      tenant_id: l.tenant_id,
      tenant_name: t?.full_name ?? null,
      tenant_phone: t?.phone ?? null,
      lease_status: l.status,
      start_date: l.start_date,
      end_date: l.end_date,
      monthly_rent: Number(l.monthly_rent ?? 0),
      deposit_1: Number(l.deposit_1 ?? 0),
      deposit_2: Number(l.deposit_2 ?? 0),
      invoiced_month: agg.invoiced_month,
      paid_month: agg.paid_month,
      balance: agg.balance,
      last_payment_date: agg.last_payment_date,
      overdue: agg.overdue,
      utility_balance: agg.utility_balance,
    };
  });

  rows.sort((a, b) =>
    (a.unit_number ?? "").localeCompare(b.unit_number ?? "", undefined, {
      numeric: true,
    })
  );

  const totals = rows.reduce(
    (acc, r) => ({
      monthly_rent: acc.monthly_rent + r.monthly_rent,
      deposit_1: acc.deposit_1 + r.deposit_1,
      deposit_2: acc.deposit_2 + r.deposit_2,
      invoiced_month: acc.invoiced_month + r.invoiced_month,
      paid_month: acc.paid_month + r.paid_month,
      balance: acc.balance + r.balance,
      overdue: acc.overdue + r.overdue,
      utility_balance: acc.utility_balance + r.utility_balance,
    }),
    emptyTotals()
  );

  return { rows, totals };
}

function emptyTotals() {
  return {
    monthly_rent: 0,
    deposit_1: 0,
    deposit_2: 0,
    invoiced_month: 0,
    paid_month: 0,
    balance: 0,
    overdue: 0,
    utility_balance: 0,
  };
}
