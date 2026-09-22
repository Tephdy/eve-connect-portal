import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { reminderEmailHtml } from "@/lib/email/templates";
import { listSubscribers } from "@/lib/db/reminder-prefs";
import { formatPHP } from "@/lib/utils/format-php";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + day;
}

type ReminderPayload = {
  key: string;
  type: "invoice_overdue" | "lease_expiring" | "rent_due_soon";
  title: string;
  severity: "info" | "warning" | "danger";
  items: { label: string; value: string; href?: string }[];
  cta_href: string;
};

/**
 * Build the reminder payloads for the current run.
 */
async function buildReminders(): Promise<ReminderPayload[]> {
  const admin = createAdminClient();
  const today = new Date();
  const todayStr = ymd(today);
  const in30 = ymd(new Date(today.getTime() + 30 * 86400000));
  const in3 = ymd(new Date(today.getTime() + 3 * 86400000));

  const reminders: ReminderPayload[] = [];

  // ---- Overdue invoices ----
  const { data: overdue } = await admin
    .from("invoice")
    .select("id, display_number, amount, due_date, lease_id, status")
    .eq("status", "overdue")
    .order("due_date", { ascending: true })
    .limit(50);

  const overdueGroups = new Map<string, any[]>();
  for (const inv of overdue ?? []) {
    const days = Math.ceil(
      (today.getTime() - new Date(inv.due_date).getTime()) / 86400000
    );
    const key = "invoice_overdue:" + inv.id;
    reminders.push({
      key,
      type: "invoice_overdue",
      title: "Overdue invoices need attention",
      severity: days > 30 ? "danger" : "warning",
      items: [
        {
          label: inv.display_number ?? "Invoice",
          value: formatPHP(inv.amount) + " · " + days + "d late",
          href: APP_URL + "/accounting/invoices/" + inv.id,
        },
      ],
      cta_href: APP_URL + "/accounting/invoices?filter=overdue",
    });
  }

  // ---- Leases expiring ----
  const { data: expiring } = await admin
    .from("lease")
    .select("id, end_date, tenant_name, unit_number")
    .eq("status", "active")
    .gte("end_date", todayStr)
    .lte("end_date", in30)
    .order("end_date", { ascending: true })
    .limit(50);

  for (const l of expiring ?? []) {
    const days = Math.ceil(
      (new Date(l.end_date).getTime() - today.getTime()) / 86400000
    );
    reminders.push({
      key: "lease_expiring:" + l.id,
      type: "lease_expiring",
      title: "Lease expiring soon",
      severity: days <= 7 ? "danger" : "warning",
      items: [
        {
          label: l.tenant_name ?? "Tenant",
          value:
            "Unit " + (l.unit_number ?? "—") + " · " + days + "d left",
          href: APP_URL + "/property/leases/" + l.id,
        },
      ],
      cta_href: APP_URL + "/property/leases",
    });
  }

  // ---- Rent dues in the next N days ----
  const { data: activeLeases } = await admin
    .from("lease")
    .select("id, due_date, monthly_rent, tenant_name, unit_number, start_date, end_date")
    .in("status", ["active", "expiring"]);

  for (const l of activeLeases ?? []) {
    if (!l.due_date) continue;
    const dueDay = Number(l.due_date.slice(8, 10));
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const safeDay = Math.min(dueDay, lastDay);
    let dueDate = new Date(today.getFullYear(), today.getMonth(), safeDay);
    if (dueDate < today) {
      const nm = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      const nmLast = new Date(nm.getFullYear(), nm.getMonth() + 1, 0).getDate();
      dueDate = new Date(nm.getFullYear(), nm.getMonth(), Math.min(dueDay, nmLast));
    }
    if (dueDate < new Date(l.start_date) || dueDate > new Date(l.end_date)) continue;

    const daysUntil = Math.ceil((dueDate.getTime() - today.getTime()) / 86400000);
    if (daysUntil < 0 || daysUntil > 3) continue;

    reminders.push({
      key: "rent_due_soon:" + l.id + ":" + ymd(dueDate),
      type: "rent_due_soon",
      title: "Rent due soon",
      severity: daysUntil <= 1 ? "warning" : "info",
      items: [
        {
          label: l.tenant_name ?? "Tenant",
          value:
            "Unit " + (l.unit_number ?? "—") + " · " +
            (daysUntil === 0 ? "Due today" : daysUntil === 1 ? "Tomorrow" : daysUntil + "d") +
            " · " + formatPHP(l.monthly_rent),
          href: APP_URL + "/property/leases/" + l.id,
        },
      ],
      cta_href: APP_URL + "/property/leases",
    });
  }

  return reminders;
}

/**
 * Send all pending reminders to all opted-in users.
 * Idempotent — checks reminder_log before sending.
 */
export async function sendReminders(): Promise<{
  sent: number;
  skipped: number;
  failed: number;
}> {
  const admin = createAdminClient();
  const subscribers = await listSubscribers();
  if (subscribers.length === 0) return { sent: 0, skipped: 0, failed: 0 };

  // Fetch user emails
  const userIds = subscribers.map((s) => s.user_id);
  const { data: users } = await admin
    .from("app_user")
    .select("id, email, full_name")
    .in("id", userIds);

  const userMap = new Map<string, any>((users ?? []).map((u: any) => [u.id, u]));

  const reminders = await buildReminders();

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  // Group reminders by type for one email per type per user
  const byType = new Map<string, ReminderPayload[]>();
  for (const r of reminders) {
    const list = byType.get(r.type) ?? [];
    list.push(r);
    byType.set(r.type, list);
  }

  for (const sub of subscribers) {
    const user = userMap.get(sub.user_id);
    if (!user?.email) continue;

    // For each reminder type the user wants
    for (const [type, list] of byType.entries()) {
      if (type === "invoice_overdue" && !sub.invoice_overdue) continue;
      if (type === "lease_expiring" && !sub.lease_expiring) continue;
      if (type === "rent_due_soon" && !sub.rent_due_soon) continue;

      if (list.length === 0) continue;

      // Group into a single email per type per user
      const groupKey = type + ":" + ymd(new Date());
      const { data: already } = await admin
        .from("reminder_log")
        .select("id")
        .eq("user_id", sub.user_id)
        .eq("reminder_key", groupKey)
        .maybeSingle();

      if (already) {
        skipped++;
        continue;
      }

      // Build email
      const title =
        type === "invoice_overdue"
          ? list.length + " overdue invoice" + (list.length === 1 ? "" : "s")
          : type === "lease_expiring"
          ? list.length + " lease" + (list.length === 1 ? "" : "s") + " expiring"
          : list.length + " rent payment" + (list.length === 1 ? "" : "s") + " due soon";

      const items = list.slice(0, 10).flatMap((r) => r.items);

      const html = reminderEmailHtml({
        recipient_name: user.full_name || user.email.split("@")[0],
        title,
        items,
        cta_label: "View in portal",
        cta_href: list[0].cta_href,
        severity: list[0].severity,
      });

      const subject =
        type === "invoice_overdue"
          ? "⚠️ " + title
          : type === "lease_expiring"
          ? "📋 " + title
          : "📅 " + title;

      const ok = await sendEmail({
        to: user.email,
        subject,
        html,
      });

      if (ok) {
        await admin.from("reminder_log").insert({
          user_id: sub.user_id,
          reminder_key: groupKey,
          channel: "email",
        });
        sent++;
      } else {
        failed++;
      }
    }
  }

  return { sent, skipped, failed };
}
