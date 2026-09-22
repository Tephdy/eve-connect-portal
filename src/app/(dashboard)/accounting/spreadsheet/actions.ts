"use server";

import { revalidatePath } from "next/cache";
import { assertPermission } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/admin";

type ActionResult = { ok: true } | { ok: false; error: string };

export type EditableField =
  | "monthly_rent"
  | "deposit_1"
  | "deposit_2"
  | "start_date"
  | "end_date";

export async function updateLeaseCellAction(
  lease_id: string,
  field: EditableField,
  rawValue: string
): Promise<ActionResult> {
  try {
    await assertPermission("lease:update");
  } catch {
    return { ok: false, error: "Forbidden: missing lease:update" };
  }

  if (!lease_id) return { ok: false, error: "Missing lease id" };

  const patch: Record<string, unknown> = {};

  if (field === "monthly_rent" || field === "deposit_1" || field === "deposit_2") {
    const n = Number(rawValue.replace(/[₱,\s]/g, ""));
    if (!Number.isFinite(n) || n < 0) {
      return { ok: false, error: "Must be a non-negative number" };
    }
    patch[field] = n;
  } else if (field === "start_date" || field === "end_date") {
    // Accept YYYY-MM-DD directly, or validate anything parseable.
    const s = rawValue.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      return { ok: false, error: "Date must be YYYY-MM-DD" };
    }
    patch[field] = s;
  } else {
    return { ok: false, error: "Field not editable" };
  }

  // If updating a date, verify end_date >= start_date after the change.
  const admin = createAdminClient();

  if (field === "start_date" || field === "end_date") {
    const { data: current } = await admin
      .schema("core")
      .from("lease")
      .select("start_date, end_date")
      .eq("id", lease_id)
      .maybeSingle();

    if (!current) return { ok: false, error: "Lease not found" };

    const start = field === "start_date" ? String(patch[field]) : String((current as any).start_date);
    const end = field === "end_date" ? String(patch[field]) : String((current as any).end_date);

    if (new Date(end).getTime() < new Date(start).getTime()) {
      return { ok: false, error: "End date must be on or after start date" };
    }
  }

  const { error } = await admin
    .schema("core")
    .from("lease")
    .update(patch)
    .eq("id", lease_id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/accounting/spreadsheet");
  return { ok: true };
}
