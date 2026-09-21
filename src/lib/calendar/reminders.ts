import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Reminder = {
  id: string;
  type: "invoice_overdue" | "lease_expiring" | "rent_due_soon";
  title: string;
  subtitle?: string;
  href: string;
  days: number;    // days until (or since) the event
  severity: "info" | "warning" | "danger";
};

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + day;
}

/**
 * Everything the user should know about right now:
 *  - Overdue invoices
 *  - Leases ending within 30 days
 *  - Rent dues in the next 3 days (from active leases)
 */
export async function getReminders(): Promise<Reminder[]> {
  const supabase = await createClient();
  const today = new Date();
  const todayStr = ymd(today);
  const in30 = ymd(new Date(today.getTime() + 30 * 86400000));
  const in3 = ymd(new Date(today.getTime() + 3 * 86400000));
  const reminders: Reminder[] = [];

  // ---- Overdue invoices ----
  const { data: overdue } = await supabase
    .from("invoice")
    .select("id, display_number, amount, due_date, lease_id")
    .eq("status", "overdue")
    .order("due_date", { ascending: true })
    .limit(20);

  for (const inv of overdue ?? []) {
    const days = Math.ceil(
      (today.getTime() - new Date(inv.due_date).getTime()) / 86400000
    );
    reminders.push({
      id: "inv_" + inv.id,
      type: "invoice_overdue",
      title: (inv.display_number ?? "Invoice") + " is overdue",
      subtitle: days + " day" + (days === 1 ? "" : "s") + " past due",
      href: "/accounting/invoices/" + inv.id,
      days,
      severity: days > 30 ? "danger" : "warning",
    });
  }

  // ---- Leases expiring soon ----
  const { data: expiring } = await supabase
    .from("lease")
    .select("id, end_date, tenant_name, unit_number")
    .eq("status", "active")
    .gte("end_date", todayStr)
    .lte("end_date", in30)
    .order("end_date", { ascending: true })
    .limit(20);

  for (const l of expiring ?? []) {
    const days = Math.ceil(
      (new Date(l.end_date).getTime() - today.getTime()) / 86400000
    );
    reminders.push({
      id: "lease_" + l.id,
      type: "lease_expiring",
      title: "Lease ending — " + (l.tenant_name ?? "Tenant"),
      subtitle:
        (l.unit_number ? "Unit " + l.unit_number + " · " : "") +
        days + " day" + (days === 1 ? "" : "s") + " left",
      href: "/property/leases/" + l.id,
      days,
      severity: days <= 7 ? "danger" : "warning",
    });
  }

  // ---- Rent dues in the next 3 days ----
  const { data: upcoming } = await supabase
    .from("lease")
    .select("id, due_date, monthly_rent, tenant_name, unit_number, status, start_date, end_date")
    .in("status", ["active", "expiring"]);

  for (const l of upcoming ?? []) {
    if (!l.due_date) continue;

    // Compute this month's due date
    const dueDay = Number(l.due_date.slice(8, 10));
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const safeDay = Math.min(dueDay, lastDay);
    const dueThisMonth = new Date(now.getFullYear(), now.getMonth(), safeDay);

    // If it's already past, look at next month
    let dueDate = dueThisMonth;
    if (dueDate < today) {
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const nmLast = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
      dueDate = new Date(
        nextMonth.getFullYear(),
        nextMonth.getMonth(),
        Math.min(dueDay, nmLast)
      );
    }

    // Skip if outside lease term
    if (dueDate < new Date(l.start_date) || dueDate > new Date(l.end_date)) continue;

    const daysUntil = Math.ceil(
      (dueDate.getTime() - today.getTime()) / 86400000
    );
    if (daysUntil > 3 || daysUntil < 0) continue;

    reminders.push({
      id: "rent_" + l.id + "_" + ymd(dueDate),
      type: "rent_due_soon",
      title: "Rent due soon — " + (l.tenant_name ?? "Tenant"),
      subtitle:
        (l.unit_number ? "Unit " + l.unit_number + " · " : "") +
        (daysUntil === 0
          ? "Due today"
          : daysUntil === 1
          ? "Due tomorrow"
          : "Due in " + daysUntil + " days"),
      href: "/property/leases/" + l.id,
      days: daysUntil,
      severity: daysUntil <= 1 ? "warning" : "info",
    });
  }

  // Sort: most urgent first
  reminders.sort((a, b) => {
    const sevOrder = { danger: 0, warning: 1, info: 2 };
    const sev = sevOrder[a.severity] - sevOrder[b.severity];
    if (sev !== 0) return sev;
    return a.days - b.days;
  });

  return reminders;
}
