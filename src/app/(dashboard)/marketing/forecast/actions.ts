"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { assertPermission } from "@/lib/auth/guard";
import { getSession } from "@/lib/auth/get-session";
import { upsertForecast, recalculateForecasts } from "@/lib/db/forecast";
import { createReservation, releaseReservation } from "@/lib/db/unit-reservations";
import type { UnitReservation } from "@/lib/db/unit-reservations";
import { createInvoice } from "@/lib/db/invoices";
import { createReceipt } from "@/lib/db/receipts";
import { uploadToDrive, validateFiles } from "@/lib/receipts/drive-upload";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit/log";
import { emit } from "@/lib/events/emit";
import { forecastOverrideSchema } from "@/lib/schemas/listing";
import { parseForm } from "@/lib/forms/parse";
import type { ActionResult } from "@/lib/actions/result";

export async function overrideForecastAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await assertPermission("forecast:override");
  const parsed = parseForm(forecastOverrideSchema, formData);
  if (!parsed.ok) return { ok: false, error: parsed.error, fieldErrors: parsed.fieldErrors };

  const session = await getSession();
  const result = await upsertForecast({
    unit_id: parsed.data.unit_id,
    earliest_available_date: parsed.data.earliest_available_date,
    confidence: parsed.data.confidence,
    notes: parsed.data.notes || null,
  });

  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "availability_forecast",
    entity_id: result.id,
    action: "update",
    after: result,
  });

  await emit("forecast.recalculated", {
    unit_id: result.unit_id,
    earliest_available_date: result.earliest_available_date,
    confidence: result.confidence,
  }, session?.id ?? null);

  revalidatePath("/marketing/forecast");
  return { ok: true, data: undefined };
}

export async function recalculateAllAction(): Promise<void> {
  await assertPermission("forecast:override");
  await recalculateForecasts();
  revalidatePath("/marketing/forecast");
}


// ---------------------------------------------------------------------------
// Reservation actions (marketing)
// ---------------------------------------------------------------------------

export async function reserveUnitAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await assertPermission("unit:reserve");
  const session = await getSession();

  const unit_id = String(formData.get("unit_id") ?? "").trim();
  const client_name = String(formData.get("client_name") ?? "").trim();
  const client_phone = String(formData.get("client_phone") ?? "").trim() || null;
  const client_email = String(formData.get("client_email") ?? "").trim() || null;
  const gender = String(formData.get("gender") ?? "").trim() || null;
  const company = String(formData.get("company") ?? "").trim() || null;
  const position = String(formData.get("position") ?? "").trim() || null;
  const vehicle_plate = String(formData.get("vehicle_plate") ?? "").trim() || null;
  const declared_occupants_raw = String(formData.get("declared_occupants") ?? "1").trim();
  const reservation_fee_raw = String(formData.get("reservation_fee") ?? "").trim();
  const payment_mode_raw = String(formData.get("payment_mode") ?? "").trim();
  const reference_number = String(formData.get("reference_number") ?? "").trim() || null;
  const inquiry_id = String(formData.get("reserve_inquiry_id") ?? "").trim() || null;

  // Lease-draft fields
  const intent = String(formData.get("intent") ?? "").trim() || null;
  const term = String(formData.get("term") ?? "").trim() || null;
  const lease_start_date = String(formData.get("lease_start_date") ?? "").trim() || null;
  const lease_end_date = String(formData.get("lease_end_date") ?? "").trim() || null;
  const move_in_date = String(formData.get("move_in_date") ?? "").trim() || null;
  const rent_due_date = String(formData.get("rent_due_date") ?? "").trim() || null;
  const monthly_rent_raw = String(formData.get("monthly_rent") ?? "").trim();
  const deposit_1_raw = String(formData.get("deposit_1") ?? "").trim();
  const deposit_2_raw = String(formData.get("deposit_2") ?? "").trim();
  const deposit_1_due_date = String(formData.get("deposit_1_due_date") ?? "").trim() || null;
  const deposit_2_due_date = String(formData.get("deposit_2_due_date") ?? "").trim() || null;
  const notice_period_days_raw = String(formData.get("notice_period_days") ?? "").trim();
  const lease_status_raw = String(formData.get("lease_status") ?? "draft").trim();

  const addOnLabels = formData.getAll("add_on_label").map((v) => String(v).trim());
  const addOnAmountsRaw = formData.getAll("add_on_amount").map((v) => String(v).trim());
  if (
    addOnAmountsRaw.some(
      (value) => value !== "" && (!Number.isFinite(Number(value)) || Number(value) < 0)
    )
  ) {
    return { ok: false, error: "Add-on amounts must be non-negative numbers" };
  }
  const addOnAmounts = addOnAmountsRaw.map((value) => Number(value || "0"));
  const add_ons = addOnLabels
    .map((label, i) => ({ label, amount: addOnAmounts[i] ?? 0 }))
    .filter((a) => a.label.length > 0);
  const add_ons_amount = add_ons.reduce((s, a) => s + a.amount, 0);

  const monthly_rent = monthly_rent_raw ? Number(monthly_rent_raw) : null;
  const deposit_1 = deposit_1_raw ? Number(deposit_1_raw) : null;
  const deposit_2 = deposit_2_raw ? Number(deposit_2_raw) : null;
  const notice_period_days = notice_period_days_raw ? Number(notice_period_days_raw) : null;
  const lease_status = lease_status_raw === "active" ? "active" : "draft";
  const invalidFinancialAmount = [monthly_rent, deposit_1, deposit_2].some(
    (value) => value !== null && (!Number.isFinite(value) || value < 0)
  );
  if (invalidFinancialAmount) {
    return {
      ok: false,
      error: "Monthly rent and security deposits must be non-negative numbers",
    };
  }

  if (!unit_id) return { ok: false, error: "Missing unit" };
  if (!client_name) return { ok: false, error: "Client name is required" };
  const declared_occupants = Number(declared_occupants_raw);
  if (!Number.isInteger(declared_occupants) || declared_occupants < 1) {
    return { ok: false, error: "Declared number of occupants must be at least 1" };
  }

  const reservation_fee = reservation_fee_raw ? Number(reservation_fee_raw) : null;
  if (reservation_fee !== null && (!Number.isFinite(reservation_fee) || reservation_fee < 0)) {
    return { ok: false, error: "Reservation fee must be a non-negative number" };
  }

  const valid_modes = ["cash", "gcash", "bank", "check", "other"] as const;
  const payment_mode =
    payment_mode_raw && (valid_modes as readonly string[]).includes(payment_mode_raw)
      ? (payment_mode_raw as (typeof valid_modes)[number])
      : null;

  const validIdEntry = formData.get("valid_id_file");
  const validIdFile =
    validIdEntry instanceof File && validIdEntry.size > 0 ? validIdEntry : null;
  const validIdMimeExtensions: Record<string, string> = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  if (validIdFile) {
    if (validIdFile.size > 10 * 1024 * 1024) {
      return { ok: false, error: "Valid ID file must be 10 MB or smaller" };
    }
    if (!validIdMimeExtensions[validIdFile.type]) {
      return {
        ok: false,
        error: "Valid ID must be a PDF, JPEG, PNG, or WebP file",
      };
    }
  }

  try {
    const reservationId = randomUUID();
    let validIdPath: string | null = null;
    const admin = createAdminClient();
    if (validIdFile) {
      validIdPath =
        reservationId +
        "/valid-id." +
        validIdMimeExtensions[validIdFile.type];
      const { error: uploadError } = await admin.storage
        .from("reservation-ids")
        .upload(validIdPath, Buffer.from(await validIdFile.arrayBuffer()), {
          contentType: validIdFile.type,
          upsert: false,
        });
      if (uploadError) throw new Error("Valid ID upload failed: " + uploadError.message);
    }

    let res: UnitReservation;
    try {
      res = await createReservation({
        id: reservationId,
        unit_id,
        client_name,
        client_phone,
        client_email,
        gender,
        company,
        position,
        valid_id_path: validIdPath,
        vehicle_plate,
        declared_occupants,
        reservation_fee,
        payment_mode,
        reference_number,
        reserved_by: session?.id ?? null,
        inquiry_id,
        intent,
        term,
        lease_start_date,
        lease_end_date,
        move_in_date,
        rent_due_date,
        monthly_rent,
        deposit_1,
        deposit_2,
        deposit_1_due_date,
        deposit_2_due_date,
        add_ons,
        add_ons_amount,
        notice_period_days,
        lease_status,
      });
    } catch (error) {
      if (validIdPath) {
        const { error: cleanupError } = await admin.storage
          .from("reservation-ids")
          .remove([validIdPath]);
        if (cleanupError) {
          console.error("[reserveUnitAction] failed to remove orphaned ID upload:", cleanupError);
        }
      }
      throw error;
    }

    // Auto-create the reservation-fee invoice
    const feeAmount = Number(reservation_fee ?? 0);
    if (feeAmount > 0) {
      try {
        await createInvoice({
          lease_id: null,
          type: "reservation_fee",
          amount: feeAmount,
          due_date: new Date().toISOString().slice(0, 10),
          status: "unpaid",
          reservation_id: res.id,
          tenant_id: (res as any).tenant_id ?? null,
        });
      } catch (err) {
        console.error("[reserveUnitAction] failed to create invoice:", err);
      }
    }

    // Optional: upload a receipt to Google Drive
    console.log("[reserveUnitAction] receipt files arrived:", formData.getAll("receipt_files").length);
    const receiptFiles = formData.getAll("receipt_files").filter(
      (f): f is File => f instanceof File
    );
    if (receiptFiles.length > 0) {
      console.log("[reserveUnitAction] entering upload block");
      try {
        const fileErr = validateFiles(receiptFiles);
        if (fileErr) {
          console.warn("[reserveUnitAction] receipt validation:", fileErr);
        } else {
          // Build the folder name from the unit's property
          const sb = await createClient();
          const { data: unitRow } = await sb
            .from("unit")
            .select("unit_number, property_id")
            .eq("id", unit_id)
            .maybeSingle();

          let propertyName = "Property";
          const propertyId = (unitRow as any)?.property_id ?? null;
          if (propertyId) {
            const { data: prop } = await sb
              .from("property")
              .select("name")
              .eq("id", propertyId)
              .maybeSingle();
            propertyName = (prop as any)?.name ?? "Property";
          }

          const unitNumber = (unitRow as any)?.unit_number ?? "Unit";
          const folderName = [propertyName, unitNumber, client_name]
            .join("-")
            .replace(/[/\\?%*:|"<>]/g, "");

          const nowDate = new Date();
          const monthFolder = nowDate.toLocaleDateString("en-PH", {
            month: "long",
            year: "numeric",
          });

          const drive = await uploadToDrive({
            folderName,
            monthFolder,
            files: receiptFiles,
            tagPrefix: "reservation-fee",
          });

          await createReceipt({
            tenant_id: null,
            property_id: propertyId,
            unit_id: unit_id,
            payment_for: ["reservation-fee"],
            custom_label: null,
            reservation_id: res.id,
            drive_folder_id: drive.folderId,
            drive_folder_url: drive.folderUrl,
            drive_file_ids: drive.files,
            uploaded_by: session?.id ?? null,
            notes: null,
            payment_month: drive.monthFolder,
          });
        }
      } catch (err) {
        // Fail-soft: reservation + invoice already succeeded
        console.error("[reserveUnitAction] receipt upload failed:", err);
      }
    }

    // @@CONTRACT_ENGINE:reservation-action-hook
    // Auto-render the reservation contract body. Non-fatal on failure.
    try {
      const { renderReservationContract } = await import(
        "@/lib/contracts/reservation-attach"
      );
      await renderReservationContract(res.id);
    } catch (renderErr) {
      console.error(
        "[reserveUnitAction] reservation contract render failed:",
        renderErr instanceof Error ? renderErr.message : renderErr
      );
    }

    await logAudit({
      actor_id: session?.id ?? null,
      entity_type: "unit_reservation",
      entity_id: res.id,
      action: "create",
      after: res,
    });

    revalidatePath("/marketing/forecast");
    return { ok: true, data: undefined };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to reserve";
    const missingReservationColumn = message.match(
      /(?:Could not find the '(\w+)' column of 'unit_reservation' in the schema cache|column unit_reservation\.(\w+) does not exist)/i
    );
    if (missingReservationColumn) {
      return {
        ok: false,
        error:
          "Reservation form fields are in place, but the database migration is not active yet. Apply supabase/migrations/20261015000000_reservation_client_details.sql in Supabase SQL Editor, then retry.",
      };
    }
    return { ok: false, error: message };
  }
}

export async function unreserveUnitAction(unit_id: string): Promise<ActionResult> {
  await assertPermission("unit:reserve");
  const session = await getSession();

  try {
    await releaseReservation({
      unit_id,
      released_by: session?.id ?? null,
      reason: null,
      new_status: "vacant",
    });

    await logAudit({
      actor_id: session?.id ?? null,
      entity_type: "unit_reservation",
      entity_id: unit_id,
      action: "update",
      after: { released: true },
    });

    revalidatePath("/marketing/forecast");
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to unreserve" };
  }
}
