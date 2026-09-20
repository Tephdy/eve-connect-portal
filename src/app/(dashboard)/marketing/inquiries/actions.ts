"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertPermission } from "@/lib/auth/guard";
import { getSession } from "@/lib/auth/get-session";
import { createInquiry, updateInquiry } from "@/lib/db/inquiries";
import { logAudit } from "@/lib/audit/log";
import { inquiryCreateSchema, inquiryUpdateSchema } from "@/lib/schemas/listing";
import { parseForm } from "@/lib/forms/parse";
import type { ActionResult } from "@/lib/actions/result";

export async function createInquiryAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await assertPermission("inquiry:create");
  const parsed = parseForm(inquiryCreateSchema, formData);
  if (!parsed.ok) return { ok: false, error: parsed.error, fieldErrors: parsed.fieldErrors };
  const session = await getSession();
  const inquiry = await createInquiry(parsed.data);
  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "inquiry", entity_id: inquiry.id, action: "create", after: inquiry,
  });
  revalidatePath("/marketing/inquiries");
  redirect("/marketing/inquiries/" + inquiry.id);
}

export async function updateInquiryAction(
  id: string,
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await assertPermission("inquiry:update");
  const parsed = parseForm(inquiryUpdateSchema, formData);
  if (!parsed.ok) return { ok: false, error: parsed.error, fieldErrors: parsed.fieldErrors };
  const session = await getSession();
  const updated = await updateInquiry(id, parsed.data);
  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "inquiry", entity_id: id, action: "update", after: updated,
  });
  revalidatePath("/marketing/inquiries");
  revalidatePath("/marketing/inquiries/" + id);
  return { ok: true, data: undefined };
}
