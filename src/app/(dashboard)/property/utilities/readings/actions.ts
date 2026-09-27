"use server";

import { revalidatePath } from "next/cache";
import { assertPermission } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { saveReadingRow, makeInvoiceFromReading } from "@/lib/db/utilities";

type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function saveReadingRowAction(input: {
  meter_id: string;
  reading: number;
  reading_date: string;
  penalty_amount: number;
  remarks: string | null;
  or_number: string | null;
  rate_snapshot: number;
}): Promise<ActionResult<{ id: string }>> {
  try {
    await assertPermission("utility:record");
  } catch {
    return { ok: false, error: "Forbidden: missing utility:record" };
  }

  if (!Number.isFinite(input.reading) || input.reading < 0)
    return { ok: false, error: "Reading must be a non-negative number" };
  if (!input.reading_date)
    return { ok: false, error: "Reading date is required" };
  if (!Number.isFinite(input.rate_snapshot) || input.rate_snapshot < 0)
    return { ok: false, error: "Rate must be a non-negative number" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  try {
    const saved = await saveReadingRow({
      meter_id: input.meter_id,
      reading: input.reading,
      reading_date: input.reading_date,
      penalty_amount: input.penalty_amount || 0,
      remarks: input.remarks,
      or_number: input.or_number,
      rate_snapshot: input.rate_snapshot,
      recorded_by: user?.id ?? null,
    });
    revalidatePath("/property/utilities/readings");
    revalidatePath("/property/utilities/billing");
    revalidatePath("/property/meters");
    return { ok: true, data: { id: saved.id } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Save failed",
    };
  }
}

export async function makeInvoiceAction(input: {
  reading_id: string;
  due_date: string;
}): Promise<ActionResult<{ invoice_id: string; display_number: string }>> {
  try {
    await assertPermission("utility:bill");
  } catch {
    return { ok: false, error: "Forbidden: missing utility:bill" };
  }
  try {
    const result = await makeInvoiceFromReading(input);
    revalidatePath("/property/utilities/readings");
    revalidatePath("/property/utilities/billing");
    revalidatePath("/accounting/invoices");
    return { ok: true, data: result };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Invoice failed",
    };
  }
}
