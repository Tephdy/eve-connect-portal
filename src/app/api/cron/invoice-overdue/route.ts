import { NextResponse } from "next/server";
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
