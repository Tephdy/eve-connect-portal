"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertPermission } from "@/lib/auth/guard";
import { getSession } from "@/lib/auth/get-session";
import { createTenant, updateTenant } from "@/lib/db/tenants";
import { logAudit } from "@/lib/audit/log";
import { tenantCreateSchema, tenantUpdateSchema } from "@/lib/schemas/tenant";
import { parseForm } from "@/lib/forms/parse";
import type { ActionResult } from "@/lib/actions/result";

export async function createTenantAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await assertPermission("tenant:create");
  const parsed = parseForm(tenantCreateSchema, formData);
  if (!parsed.ok) return { ok: false, error: parsed.error, fieldErrors: parsed.fieldErrors };
  const session = await getSession();
  const fromReservationId = String(formData.get("from_reservation_id") ?? "").trim() || null;

  // If a reservation was selected, pull its inquiry_id too (if any)
  let inquiryId: string | null = null;
  if (fromReservationId) {
    try {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const admin = createAdminClient();
      const { data: res } = await admin
        .schema("acct")
        .from("unit_reservation")
        .select("inquiry_id")
        .eq("id", fromReservationId)
        .maybeSingle();
      inquiryId = (res as any)?.inquiry_id ?? null;
    } catch {
      // non-fatal
    }
  }

  const tenant = await createTenant({
    ...parsed.data,
    reservation_id: fromReservationId,
    inquiry_id: inquiryId,
  });

  // Backfill tenant_id on any invoices linked to this tenant's reservation
  if (fromReservationId) {
    try {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const admin = createAdminClient();

      // Update invoices
      const { data: linkedInvoices } = await admin
        .schema("acct")
        .from("invoice")
        .select("id")
        .eq("reservation_id", fromReservationId);

      if (linkedInvoices && linkedInvoices.length > 0) {
        const invoiceIds = linkedInvoices.map((i: any) => i.id);

        await admin
          .schema("acct")
          .from("invoice")
          .update({ tenant_id: tenant.id })
          .in("id", invoiceIds);

        // Also stamp the payments on those invoices
        await admin
          .schema("acct")
          .from("payment")
          .update({ tenant_id: tenant.id })
          .in("invoice_id", invoiceIds);
      }
    } catch (err) {
      console.error("[createTenantAction] backfill failed:", err);
    }
  }

  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "tenant",
    entity_id: tenant.id,
    action: "create",
    after: tenant,
  });
  revalidatePath("/property/tenants");
  revalidatePath("/accounting/reservations");
  revalidatePath("/marketing/forecast");
  redirect("/property/tenants/" + tenant.id);
}

export async function updateTenantAction(
  id: string,
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await assertPermission("tenant:update");
  const parsed = parseForm(tenantUpdateSchema, formData);
  if (!parsed.ok) return { ok: false, error: parsed.error, fieldErrors: parsed.fieldErrors };
  const session = await getSession();
  const updated = await updateTenant(id, parsed.data);

  // markTenantActivePropagation: when status flips to "active",
  // mark the reservation's unit as occupied and the inquiry as converted.
  if (parsed.data.status === "active") {
    await markTenantActivePropagation(updated, session?.id ?? null);
  }
  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "tenant",
    entity_id: id,
    action: "update",
    after: updated,
  });
  revalidatePath("/property/tenants");
  revalidatePath("/property/tenants/" + id);
  return { ok: true, data: undefined };
}


// ---------------------------------------------------------------------------
// Propagation helper
// ---------------------------------------------------------------------------

async function markTenantActivePropagation(
  tenant: { id: string; full_name: string; reservation_id: string | null; inquiry_id: string | null },
  actor_id: string | null
): Promise<void> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();

  // 1. Unit → occupied via reservation
  if (tenant.reservation_id) {
    try {
      const { data: reservation } = await admin
        .schema("acct")
        .from("unit_reservation")
        .select("unit_id")
        .eq("id", tenant.reservation_id)
        .maybeSingle();

      const unitId = (reservation as any)?.unit_id;
      if (unitId) {
        await admin.from("unit").update({ status: "occupied" }).eq("id", unitId);
        await logAudit({
          actor_id,
          entity_type: "unit",
          entity_id: unitId,
          action: "update",
          after: { status: "occupied", reason: "tenant active via " + tenant.id },
        });
      }
    } catch (err) {
      console.error("[markTenantActivePropagation] unit update failed:", err);
    }
  }

  // 2. Inquiry → converted via tenant.inquiry_id
  if (tenant.inquiry_id) {
    try {
      await admin
        .from("inquiry")
        .update({ status: "converted" })
        .eq("id", tenant.inquiry_id);
      await logAudit({
        actor_id,
        entity_type: "inquiry",
        entity_id: tenant.inquiry_id,
        action: "update",
        after: { status: "converted" },
      });
    } catch (err) {
      console.error("[markTenantActivePropagation] inquiry update failed:", err);
    }
  }

  // Revalidate the pages that care
  revalidatePath("/property/units");
  revalidatePath("/marketing/inquiries");
  revalidatePath("/marketing/forecast");
}
