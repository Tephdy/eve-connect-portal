import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = createAdminClient();

  const invoiceQ = await admin
    .schema("acct").from("invoice")
    .select("id, amount, display_number, status")
    .neq("status", "void");

  const paymentQ = await admin
    .schema("acct").from("payment")
    .select("invoice_id, amount");

  const paymentLimited = await admin
    .schema("acct").from("payment")
    .select("invoice_id, amount")
    .limit(3);

  return NextResponse.json({
    invoice: {
      count: invoiceQ.data?.length ?? null,
      error: invoiceQ.error?.message ?? null,
      sample: invoiceQ.data?.[0] ?? null,
    },
    paymentAll: {
      count: paymentQ.data?.length ?? null,
      error: paymentQ.error?.message ?? null,
      sample: paymentQ.data?.[0] ?? null,
    },
    paymentLimited: {
      count: paymentLimited.data?.length ?? null,
      error: paymentLimited.error?.message ?? null,
      sample: paymentLimited.data?.[0] ?? null,
    },
  });
}