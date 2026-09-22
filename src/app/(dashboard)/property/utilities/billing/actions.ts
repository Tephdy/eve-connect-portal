"use server";

import { revalidatePath } from "next/cache";
import { assertPermission } from "@/lib/auth/guard";
import { computeCharges, generateUtilityInvoices } from "@/lib/db/utilities";

type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function generateBillsAction(month: string): Promise<
  ActionResult<{ created: number; skipped: number; errors: string[] }>
> {
  try {
    await assertPermission("utility:bill");
  } catch {
    return { ok: false, error: "Forbidden: missing utility:bill" };
  }

  try {
    const charges = await computeCharges(month);
    if (charges.length === 0) {
      return { ok: false, error: "No charges to bill for " + month };
    }
    const [y, m] = month.split("-").map(Number);
    const due = new Date(Date.UTC(y, m, 15)).toISOString().slice(0, 10);
    const result = await generateUtilityInvoices(charges, due);
    revalidatePath("/property/utilities/billing");
    revalidatePath("/accounting/invoices");
    return { ok: true, data: result };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to generate bills",
    };
  }
}
