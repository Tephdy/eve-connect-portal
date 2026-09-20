"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertPermission } from "@/lib/auth/guard";
import { getSession } from "@/lib/auth/get-session";
import {
  createListing, updateListing, publishListing, unpublishListing,
} from "@/lib/db/listings";
import { logAudit } from "@/lib/audit/log";
import { emit } from "@/lib/events/emit";
import { listingCreateSchema, listingUpdateSchema } from "@/lib/schemas/listing";
import { parseForm } from "@/lib/forms/parse";
import type { ActionResult } from "@/lib/actions/result";

export async function createListingAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await assertPermission("listing:create");
  const parsed = parseForm(listingCreateSchema, formData);
  if (!parsed.ok) return { ok: false, error: parsed.error, fieldErrors: parsed.fieldErrors };
  const session = await getSession();
  const listing = await createListing(parsed.data);
  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "listing", entity_id: listing.id, action: "create", after: listing,
  });
  revalidatePath("/marketing/listings");
  redirect("/marketing/listings/" + listing.id);
}

export async function updateListingAction(
  id: string,
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await assertPermission("listing:update");
  const parsed = parseForm(listingUpdateSchema, formData);
  if (!parsed.ok) return { ok: false, error: parsed.error, fieldErrors: parsed.fieldErrors };
  const session = await getSession();
  const updated = await updateListing(id, parsed.data);
  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "listing", entity_id: id, action: "update", after: updated,
  });
  revalidatePath("/marketing/listings");
  revalidatePath("/marketing/listings/" + id);
  return { ok: true, data: undefined };
}

export async function publishListingAction(id: string) {
  await assertPermission("listing:publish");
  const session = await getSession();
  await publishListing(id);
  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "listing", entity_id: id, action: "update",
    after: { status: "published" },
  });
  await emit("listing.published", { listing_id: id }, session?.id ?? null);
  revalidatePath("/marketing/listings");
  revalidatePath("/marketing/listings/" + id);
}

export async function unpublishListingAction(id: string) {
  await assertPermission("listing:publish");
  const session = await getSession();
  await unpublishListing(id);
  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "listing", entity_id: id, action: "update",
    after: { status: "unlisted" },
  });
  revalidatePath("/marketing/listings");
  revalidatePath("/marketing/listings/" + id);
}
