import { requirePagePermission } from "@/lib/auth/guard";
import { getSession } from "@/lib/auth/get-session";
import { getPrefs } from "@/lib/db/reminder-prefs";
import { PageHeader } from "@/components/layout/page-header";
import { ReminderPrefsForm } from "@/components/settings/reminder-prefs-form";

export default async function NotificationSettingsPage() {
  await requirePagePermission("invoice:read");
  const session = await getSession();
  if (!session) return null;

  const prefs = await getPrefs(session.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notification settings"
        description="Choose what emails you receive."
      />
      <ReminderPrefsForm prefs={prefs} />
    </div>
  );
}
