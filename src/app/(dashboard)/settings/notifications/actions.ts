"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/get-session";
import { savePrefs } from "@/lib/db/reminder-prefs";
import { logAudit } from "@/lib/audit/log";

export async function saveReminderPrefsAction(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  const prefs = {
    user_id: session.id,
    email_enabled: formData.get("email_enabled") === "on",
    invoice_overdue: formData.get("invoice_overdue") === "on",
    lease_expiring: formData.get("lease_expiring") === "on",
    rent_due_soon: formData.get("rent_due_soon") === "on",
    days_before: Number(formData.get("days_before") ?? 3),
  };

  await savePrefs(prefs);
  await logAudit({
    actor_id: session.id,
    entity_type: "reminder_pref",
    entity_id: session.id,
    action: "update",
    after: prefs,
  });

  revalidatePath("/settings/notifications");
}
