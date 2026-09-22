import { NextResponse } from "next/server";
import { computeCharges, generateUtilityInvoices } from "@/lib/db/utilities";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET not set" }, { status: 500 });
  if (req.headers.get("authorization") !== "Bearer " + secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // The billing month defaults to the previous month (you bill after reading).
  const url = new URL(req.url);
  const month = url.searchParams.get("month") ?? previousMonth();
  const due_date = url.searchParams.get("due_date") ?? defaultDue(month);

  try {
    const charges = await computeCharges(month);
    const result = await generateUtilityInvoices(charges, due_date);
    return NextResponse.json({ ok: true, month, due_date, charges: charges.length, ...result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "run failed" }, { status: 500 });
  }
}

function previousMonth(): string {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 7);
}

function defaultDue(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m, 15));
  return d.toISOString().slice(0, 10);
}
