import { NextResponse } from "next/server";
import { requirePagePermission } from "@/lib/auth/guard";
import { getSpreadsheetRows } from "@/lib/db/spreadsheet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export async function GET(req: Request) {
  await requirePagePermission("report:read");

  const url = new URL(req.url);
  const property_id = url.searchParams.get("property");
  const month = url.searchParams.get("month") ?? new Date().toISOString().slice(0, 7);

  if (!property_id) {
    return NextResponse.json({ error: "missing property" }, { status: 400 });
  }

  const { rows } = await getSpreadsheetRows(property_id, month);

  const header = [
    "Unit",
    "Tenant",
    "Phone",
    "Status",
    "Start",
    "End",
    "Monthly rent",
    "Deposit 1",
    "Deposit 2",
    "Invoiced (" + month + ")",
    "Paid (" + month + ")",
    "Balance",
    "Last payment",
    "Overdue",
    "Utility balance",
  ];

  const body = [header.join(",")];
  for (const r of rows) {
    body.push(
      [
        cell(r.unit_number),
        cell(r.tenant_name),
        cell(r.tenant_phone),
        cell(r.lease_status),
        cell(r.start_date),
        cell(r.end_date),
        cell(r.monthly_rent),
        cell(r.deposit_1),
        cell(r.deposit_2),
        cell(r.invoiced_month),
        cell(r.paid_month),
        cell(r.balance),
        cell(r.last_payment_date),
        cell(r.overdue),
        cell(r.utility_balance),
      ].join(",")
    );
  }

  const csv = body.join("\n");
  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition":
        'attachment; filename="spreadsheet-' + month + "-" + stamp + '.csv"',
      "Cache-Control": "no-store",
    },
  });
}
