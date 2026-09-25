"use server";

import { revalidatePath } from "next/cache";
import { assertPermission } from "@/lib/auth/guard";
import { getSession } from "@/lib/auth/get-session";
import { createReceipt } from "@/lib/db/receipts";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit/log";
import type { ActionResult } from "@/lib/actions/result";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 20;
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];

export type UploadResult = {
  folderUrl: string;
  folderName: string;
  fileCount: number;
};

export async function uploadReceiptAction(
  _prev: ActionResult<UploadResult> | null,
  formData: FormData
): Promise<ActionResult<UploadResult>> {
  try {
    await assertPermission("payment:read");
  } catch {
    return { ok: false, error: "Forbidden: missing payment:read" };
  }

  const session = await getSession();
  const ownerRaw = String(formData.get("tenant_id") ?? "").trim();
  const [ownerKind, ownerUuid] = ownerRaw.split(":");
  const kind = ownerKind === "reservation" ? "reservation" : "tenant";
  const tenantId = kind === "tenant" ? (ownerUuid || null) : null;
  const reservationId = kind === "reservation" ? (ownerUuid || null) : null;
  const paymentForList = formData.getAll("payment_for").map((v) => String(v));
  const customLabel = String(formData.get("custom_label") ?? "").trim() || null;
  // (removed duplicate declaration — reservationId is derived below from the tenant picker)
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const reference_no = String(formData.get("reference_no") ?? "").trim() || null;
  const paymentMonthRaw = String(formData.get("payment_month") ?? "").trim();
  const files = formData.getAll("files").filter((f): f is File => f instanceof File);

  if (!tenantId && !reservationId) {
    return { ok: false, error: "Select a tenant or reservation" };
  }
  if (!/^\d{4}-\d{2}$/.test(paymentMonthRaw)) {
    return { ok: false, error: "Pick a valid month" };
  }
  if (paymentForList.length === 0) return { ok: false, error: "Pick at least one payment type" };
  if (paymentForList.includes("others") && !customLabel) {
    return { ok: false, error: "Enter a custom label for 'Others'" };
  }
  if (files.length === 0) return { ok: false, error: "Attach at least one file" };
  if (files.length > MAX_FILES) return { ok: false, error: "Too many files (" + files.length + ", max " + MAX_FILES + ")" };

  for (const f of files) {
    if (f.size > MAX_FILE_SIZE) return { ok: false, error: f.name + " exceeds 10 MB" };
    if (!ALLOWED_MIME.includes(f.type)) return { ok: false, error: f.name + " has unsupported type" };
  }

  const supabase = await createClient();

  // Resolve the payer: either an existing tenant or an open reservation.
  let tenantFullName = "";
  let tenantLookupId: string | null = tenantId;
  let reservationUnitId: string | null = null;

  if (kind === "reservation" && reservationId) {
    const { data: res } = await supabase
      .schema("acct")
      .from("unit_reservation")
      .select("client_name, unit_id")
      .eq("id", reservationId)
      .maybeSingle();
    if (!res) return { ok: false, error: "Reservation not found" };
    tenantFullName = (res as any).client_name ?? "";
    reservationUnitId = (res as any).unit_id ?? null;
  } else if (tenantId) {
    const { data: tenant } = await supabase
      .from("tenant")
      .select("id, full_name")
      .eq("id", tenantId)
      .maybeSingle();
    if (!tenant) return { ok: false, error: "Tenant not found" };
    tenantFullName = tenant.full_name;
  }

  let unitId: string | null = reservationUnitId;

  if (kind === "tenant" && tenantId) {
    const { data: leases } = await supabase
      .from("lease")
      .select("unit_id, status, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(1);
    const lease = leases?.[0];
    if (!unitId) unitId = lease?.unit_id ?? null;
  }
  let propertyId: string | null = null;
  let unitNumber = "Unit";
  let propertyName = "Property";

  if (unitId) {
    const { data: unit } = await supabase
      .from("unit")
      .select("id, unit_number, property_id")
      .eq("id", unitId)
      .maybeSingle();
    if (unit) {
      unitNumber = (unit as any).unit_number ?? "Unit";
      propertyId = (unit as any).property_id ?? null;
      if (propertyId) {
        const { data: prop } = await supabase
          .from("property")
          .select("name")
          .eq("id", propertyId)
          .maybeSingle();
        if (prop) propertyName = (prop as any).name ?? "Property";
      }
    }
  }

  const folderName = [propertyName, unitNumber, tenantFullName]
    .join("-")
    .replace(/[/\\?%*:|"<>]/g, "");

  const tags = paymentForList.includes("all")
    ? ["all"]
    : paymentForList.filter((t) => t !== "others");
  if (paymentForList.includes("others") && customLabel) {
    tags.push(customLabel.replace(/[^a-z0-9]+/gi, "_"));
  }
  const tagString = (tags.join("+") || "receipt").toLowerCase();
  const date = new Date().toISOString().slice(0, 10);

  const payloadFiles: { name: string; mimeType: string; base64: string }[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const ext = f.name.split(".").pop() || "bin";
    const buffer = Buffer.from(await f.arrayBuffer());
    payloadFiles.push({
      name: tagString + "-" + date + "-" + (i + 1) + "." + ext,
      mimeType: f.type,
      base64: buffer.toString("base64"),
    });
  }

  const scriptUrl = process.env.GOOGLE_DRIVE_SCRIPT_URL;
  if (!scriptUrl) return { ok: false, error: "GOOGLE_DRIVE_SCRIPT_URL not set" };

  // Month folder name from the picked month (e.g. "September 2026")
  const [yy, mm] = paymentMonthRaw.split("-").map(Number);
  const monthFolder = new Date(yy, mm - 1, 1).toLocaleDateString("en-PH", {
    month: "long",
    year: "numeric",
  });

  let driveResult: any;
  try {
    const res = await fetch(scriptUrl, {
      method: "POST",
      body: JSON.stringify({ folderName, monthFolder, files: payloadFiles }),
      cache: "no-store",
    });
    driveResult = await res.json();
  } catch (err) {
    return {
      ok: false,
      error: "Google Drive upload failed: " + (err instanceof Error ? err.message : String(err)),
    };
  }

  if (!driveResult?.success) {
    return { ok: false, error: driveResult?.error ?? "Drive upload failed" };
  }

  try {
    const receipt = await createReceipt({
      tenant_id: tenantId,
      property_id: propertyId,
      unit_id: unitId,
      payment_for: paymentForList,
      custom_label: customLabel,
      reservation_id: reservationId,
      drive_folder_id: driveResult.folderId,
      drive_folder_url: driveResult.folderUrl,
      drive_file_ids: driveResult.files ?? [],
      uploaded_by: session?.id ?? null,
      notes,
      payment_month: monthFolder,
      reference_no,
    });

    await logAudit({
      actor_id: session?.id ?? null,
      entity_type: "tenant_receipt",
      entity_id: receipt.id,
      action: "create",
      after: { folder: driveResult.folderName, files: driveResult.files?.length ?? 0 },
    });

    revalidatePath("/property/receipts");
    revalidatePath("/accounting/receipts");

    return {
      ok: true,
      data: {
        folderUrl: driveResult.folderUrl,
        folderName: driveResult.folderName,
        fileCount: driveResult.files?.length ?? 0,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: "Uploaded to Drive but DB insert failed: " + (err instanceof Error ? err.message : String(err)),
    };
  }
}
