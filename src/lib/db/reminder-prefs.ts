import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type ReminderPrefs = {
  user_id: string;
  email_enabled: boolean;
  invoice_overdue: boolean;
  lease_expiring: boolean;
  rent_due_soon: boolean;
  days_before: number;
};

export async function getPrefs(user_id: string): Promise<ReminderPrefs> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reminder_pref")
    .select("user_id, email_enabled, invoice_overdue, lease_expiring, rent_due_soon, days_before")
    .eq("user_id", user_id)
    .maybeSingle();

  if (data) return data as ReminderPrefs;

  // Defaults when no row exists
  return {
    user_id,
    email_enabled: true,
    invoice_overdue: true,
    lease_expiring: true,
    rent_due_soon: true,
    days_before: 3,
  };
}

export async function savePrefs(input: Partial<ReminderPrefs> & { user_id: string }) {
  const admin = createAdminClient();
  const { error } = await admin.from("reminder_pref").upsert(
    {
      ...input,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) throw new Error(error.message);
}

export async function listSubscribers(): Promise<ReminderPrefs[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("reminder_pref")
    .select("user_id, email_enabled, invoice_overdue, lease_expiring, rent_due_soon, days_before")
    .eq("email_enabled", true);
  return (data ?? []) as ReminderPrefs[];
}
